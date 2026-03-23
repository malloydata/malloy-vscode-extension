/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {
  Connection,
  ConnectionConfigEntry,
  LookupConnection,
  MalloyConfig,
  getRegisteredConnectionTypes,
  getConnectionProperties,
} from '@malloydata/malloy';
import {UnresolvedConnectionConfigEntry} from './types/connection_manager_types';
import {ConnectionFactory} from './connections/types';

export type SecretResolver = (key: string) => Promise<string | undefined>;

export function isSecretKeyReference(
  value: unknown
): value is {secretKey: string} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'secretKey' in value &&
    typeof (value as Record<string, unknown>)['secretKey'] === 'string'
  );
}

/**
 * Build default connections from the registry.
 *
 * - **Browser** (`duckdb_wasm` registered, `duckdb` not): returns a single
 *   `duckdb` connection backed by the wasm type.
 * - **Node**: one `{is: typeName}` entry per registered type, plus the
 *   legacy `md` (MotherDuck) alias.
 */
export function getDefaultConnections(): Record<string, ConnectionConfigEntry> {
  const registeredTypes = getRegisteredConnectionTypes();

  // Browser: only duckdb_wasm is available — alias it as 'duckdb'
  if (
    registeredTypes.includes('duckdb_wasm') &&
    !registeredTypes.includes('duckdb')
  ) {
    return {duckdb: {is: 'duckdb_wasm'}};
  }

  // Node: one entry per registered type + md (MotherDuck) alias
  const defaults: Record<string, ConnectionConfigEntry> = {};
  for (const typeName of registeredTypes) {
    defaults[typeName] = {is: typeName};
  }
  defaults['md'] = {is: 'duckdb', databasePath: 'md:'};
  return defaults;
}

/**
 * Inject `workingDirectory` into connection config entries whose registered
 * type supports it, unless the entry already sets it explicitly.
 */
function injectWorkingDirectory(
  connections: Record<string, ConnectionConfigEntry>,
  workingDir: string
): Record<string, ConnectionConfigEntry> {
  const result = {...connections};
  for (const [name, entry] of Object.entries(result)) {
    if (entry['workingDirectory'] !== undefined) continue;
    const props = getConnectionProperties(entry.is);
    if (props?.some(p => p.name === 'workingDirectory')) {
      result[name] = {...entry, workingDirectory: workingDir};
    }
  }
  return result;
}

export class MergedConnectionLookup implements LookupConnection<Connection> {
  constructor(
    private primary: LookupConnection<Connection>,
    private fallback: LookupConnection<Connection>
  ) {}

  async lookupConnection(name: string): Promise<Connection> {
    try {
      return await this.primary.lookupConnection(name);
    } catch {
      return await this.fallback.lookupConnection(name);
    }
  }
}

export class SettingsConnectionLookup implements LookupConnection<Connection> {
  private cache = new Map<string, Promise<Connection>>();

  constructor(
    private config: Record<string, UnresolvedConnectionConfigEntry>,
    private secretResolver: SecretResolver,
    private workingDirectory?: string,
    private postProcess?: (conn: Connection, workingDir: string) => void
  ) {}

  lookupConnection(name: string): Promise<Connection> {
    let promise = this.cache.get(name);
    if (!promise) {
      promise = this.createConnection(name);
      this.cache.set(name, promise);
    }
    return promise;
  }

  private async createConnection(name: string): Promise<Connection> {
    const entry = this.config[name];
    if (!entry) throw new Error(`No connection named '${name}'`);

    const resolved = await this.resolveEntry(entry);

    // Inject workingDirectory if the type supports it and entry doesn't set it
    if (this.workingDirectory && resolved['workingDirectory'] === undefined) {
      const props = getConnectionProperties(resolved.is);
      if (props?.some(p => p.name === 'workingDirectory')) {
        resolved['workingDirectory'] = this.workingDirectory;
      }
    }

    const config = new MalloyConfig('{"connections":{}}');
    config.connectionMap = {[name]: resolved};
    const conn = await config.connections.lookupConnection(name);
    if (this.postProcess && this.workingDirectory) {
      this.postProcess(conn, this.workingDirectory);
    }
    return conn;
  }

  private async resolveEntry(
    entry: UnresolvedConnectionConfigEntry
  ): Promise<ConnectionConfigEntry> {
    const resolved: ConnectionConfigEntry = {is: entry.is};
    for (const [key, value] of Object.entries(entry)) {
      if (key === 'is') continue;
      if (isSecretKeyReference(value)) {
        const secret = await this.secretResolver(value.secretKey);
        if (secret !== undefined) {
          resolved[key] = secret;
        }
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }
}

export class CommonConnectionManager {
  currentRowLimit = 50;
  workspaceRoots: string[] = [];
  private projectConnectionsOnly = false;
  private globalConfigDirectory = '';
  private secretResolver: SecretResolver | undefined;

  /** Merged settings config (defaults + user) for lazy per-directory lookups. */
  private mergedSettingsConfig:
    | Record<string, UnresolvedConnectionConfigEntry>
    | undefined;
  /** Cached per-workingDir settings lookups (non-resolver path only). */
  private settingsLookupsByDir: Record<string, LookupConnection<Connection>> =
    {};
  /** New-format settings config (for tree view / config manager). */
  private settingsConfig:
    | Record<string, UnresolvedConnectionConfigEntry>
    | undefined;

  // Cache: cacheKey -> MalloyConfig (handles connection caching + lifecycle)
  private configCache: Record<
    string,
    {config: MalloyConfig; configText: string; manifestText?: string}
  > = {};
  // Mapping: fileURL.toString() -> config cache key, populated by resolveConfigForFile
  private fileConfigKey: Record<string, string> = {};

  constructor(private connectionFactory: ConnectionFactory) {}

  public setProjectConnectionsOnly(value: boolean): void {
    this.projectConnectionsOnly = value;
  }

  public setGlobalConfigDirectory(dir: string): void {
    if (this.globalConfigDirectory !== dir) {
      this.globalConfigDirectory = dir;
      this.clearConfigCaches();
    }
  }

  public setSecretResolver(resolver: SecretResolver): void {
    this.secretResolver = resolver;
  }

  public setWorkspaceRoots(roots: string[]): void {
    this.workspaceRoots = roots;
  }

  public clearConfigCaches(): void {
    for (const entry of Object.values(this.configCache)) {
      entry.config.close().catch(err => {
        console.warn('Error closing config connections:', err);
      });
    }
    this.configCache = {};
    this.settingsLookupsByDir = {};
    this.fileConfigKey = {};
  }

  private resolveConfigForFile(
    fileURL: URL,
    workingDir: string
  ): MalloyConfig | undefined {
    if (!this.connectionFactory.findMalloyConfig) {
      return undefined;
    }

    const globalDir = this.projectConnectionsOnly
      ? ''
      : this.globalConfigDirectory;
    const result = this.connectionFactory.findMalloyConfig(
      fileURL,
      this.workspaceRoots,
      globalDir
    );

    if (!result) {
      return undefined;
    }

    // Cache key includes working directory so files in different directories
    // get separate connection instances with correct workingDirectory.
    const cacheKey = `${result.configDir}::${workingDir}`;
    this.fileConfigKey[fileURL.toString()] = cacheKey;
    // Return cached config if the config text hasn't changed.
    // Manifest can change independently; keep the same config and refresh
    // only the embedded manifest when needed.
    const cached = this.configCache[cacheKey];
    if (cached && cached.configText === result.configText) {
      if (cached.manifestText !== result.manifestText) {
        cached.config.manifest.loadText(result.manifestText ?? '{}');
        cached.manifestText = result.manifestText;
      }
      return cached.config;
    }

    // Close connections from the previous config before replacing
    if (cached) {
      cached.config.close().catch(err => {
        console.warn('Error closing config connections:', err);
      });
    }

    // Parse and create MalloyConfig with connection caching + postProcess
    try {
      const config = new MalloyConfig(result.configText);
      const map = injectWorkingDirectory(
        config.connectionMap ?? {},
        workingDir
      );
      config.connectionMap = map;

      const postProcess = this.connectionFactory.postProcessConnection?.bind(
        this.connectionFactory
      );
      if (postProcess) {
        config.onConnectionCreated = (_name, conn) =>
          postProcess(conn, workingDir);
      }
      config.manifest.loadText(result.manifestText ?? '{}');

      this.configCache[cacheKey] = {
        config,
        configText: result.configText,
        manifestText: result.manifestText,
      };
      return config;
    } catch (error) {
      console.warn(
        `Failed to parse malloy-config.json in ${result.configDir}:`,
        error
      );
      return undefined;
    }
  }

  public getConnectionLookup(fileURL: URL): LookupConnection<Connection> {
    const workingDir = this.connectionFactory.getWorkingDirectory(fileURL);
    const config = this.resolveConfigForFile(fileURL, workingDir);
    const configLookup = config?.connections;

    if (this.projectConnectionsOnly) {
      return (
        configLookup ?? {
          lookupConnection: (name: string) =>
            Promise.reject(
              new Error(
                `No connection '${name}' found in config file (projectConnectionsOnly is enabled)`
              )
            ),
        }
      );
    }

    // Merged: config file takes precedence, settings as fallback.
    // Both sides handle their own caching and postProcessConnection
    // internally, so no outer wrapLookup is needed.
    const settingsLookup = this.getSettingsLookup(workingDir);
    if (configLookup && settingsLookup) {
      return new MergedConnectionLookup(configLookup, settingsLookup);
    }
    return configLookup ?? settingsLookup ?? this.emptyLookup();
  }

  /** Return the cached MalloyConfig for a file, if one exists. */
  public getConfigForFile(fileURL: URL): MalloyConfig | undefined {
    const existingKey = this.fileConfigKey[fileURL.toString()];
    if (existingKey) {
      const cached = this.configCache[existingKey];
      if (cached) {
        return cached.config;
      }
    }
    const workingDir = this.connectionFactory.getWorkingDirectory(fileURL);
    return this.resolveConfigForFile(fileURL, workingDir);
  }

  public setCurrentRowLimit(rowLimit: number): void {
    this.currentRowLimit = rowLimit;
  }

  public getCurrentRowLimit(): number | undefined {
    return this.currentRowLimit;
  }

  /**
   * Returns the new-format connections config, if settings are in the new
   * format. Used by the tree view and config manager.
   */
  public getNewFormatConfig():
    | Record<string, UnresolvedConnectionConfigEntry>
    | undefined {
    return this.settingsConfig;
  }

  public setConnectionsConfig(
    connectionsConfig: Record<string, UnresolvedConnectionConfigEntry>
  ): void {
    this.connectionFactory.reset();
    this.clearConfigCaches();

    this.settingsConfig = connectionsConfig;

    // Merge defaults under user connections (user entries take precedence)
    this.mergedSettingsConfig = {
      ...getDefaultConnections(),
      ...connectionsConfig,
    };
    this.settingsLookupsByDir = {};
  }

  private getSettingsLookup(
    workingDir: string
  ): LookupConnection<Connection> | undefined {
    if (!this.mergedSettingsConfig) return undefined;

    const postProcess = this.connectionFactory.postProcessConnection?.bind(
      this.connectionFactory
    );

    if (this.secretResolver) {
      // Lazy resolution: secrets are resolved at lookupConnection() time.
      // SettingsConnectionLookup caches connections internally by name,
      // so repeated lookupConnection() calls return the same Connection.
      return new SettingsConnectionLookup(
        this.mergedSettingsConfig,
        this.secretResolver,
        workingDir,
        postProcess
      );
    }

    // No resolver (e.g., browser) — create connections eagerly, cached per dir.
    // MalloyConfig caches connections internally; we cache the lookup per dir.
    const cached = this.settingsLookupsByDir[workingDir];
    if (cached) return cached;

    const map = injectWorkingDirectory(
      this.mergedSettingsConfig as Record<string, ConnectionConfigEntry>,
      workingDir
    );
    try {
      const config = new MalloyConfig('{"connections":{}}');
      config.connectionMap = map;
      if (postProcess) {
        config.onConnectionCreated = (_name, conn) =>
          postProcess(conn, workingDir);
      }
      const lookup = config.connections;
      this.settingsLookupsByDir[workingDir] = lookup;
      return lookup;
    } catch (error) {
      console.warn('Failed to create connections from settings config:', error);
      return undefined;
    }
  }

  private emptyLookup(): LookupConnection<Connection> {
    return {
      lookupConnection: (name: string) =>
        Promise.reject(new Error(`No connection '${name}' configured`)),
    };
  }
}

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
  BuildManifest,
  Connection,
  ConnectionConfigEntry,
  LookupConnection,
  Manifest,
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
 * Build default connections from the registry: one `{is: typeName}` entry
 * per registered type, plus the legacy `md` (MotherDuck) alias.
 */
function getDefaultConnections(): Record<string, ConnectionConfigEntry> {
  const defaults: Record<string, ConnectionConfigEntry> = {};
  for (const typeName of getRegisteredConnectionTypes()) {
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

/** Create a LookupConnection from a connection map via MalloyConfig. */
function connectionsFromMap(
  map: Record<string, ConnectionConfigEntry>
): LookupConnection<Connection> {
  const config = new MalloyConfig('{"connections":{}}');
  config.connectionMap = map;
  return config.connections;
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
  constructor(
    private config: Record<string, UnresolvedConnectionConfigEntry>,
    private secretResolver: SecretResolver,
    private workingDirectory?: string
  ) {}

  async lookupConnection(name: string): Promise<Connection> {
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

    const lookup = connectionsFromMap({[name]: resolved});
    return lookup.lookupConnection(name);
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
        resolved[key] = value as
          | string
          | number
          | boolean
          | {env: string}
          | undefined;
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

  // Cache: configDir -> parsed lookup + the configText it was parsed from
  // `connections` tracks every Connection created via the lookup so we can
  // close them when the config changes (which clears DuckDB's static cache).
  private configLookups: Record<
    string,
    {
      lookup: LookupConnection<Connection>;
      configText: string;
      connections: Connection[];
    }
  > = {};

  // Cache: configDir -> parsed manifest + the manifestText it was parsed from
  private manifestCache: Record<
    string,
    {manifestText: string; buildManifest: BuildManifest}
  > = {};

  // Mapping: fileURL.toString() -> configDir, populated by resolveConfigForFile
  private fileConfigDir: Record<string, string> = {};

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

  /** Close all connections tracked by a config cache entry. */
  private closeConfigConnections(entry: {connections: Connection[]}): void {
    for (const conn of entry.connections) {
      conn.close().catch(err => {
        console.warn('Error closing config connection:', err);
      });
    }
    entry.connections = [];
  }

  public clearConfigCaches(): void {
    for (const entry of Object.values(this.configLookups)) {
      this.closeConfigConnections(entry);
    }
    this.configLookups = {};
    this.settingsLookupsByDir = {};
    this.manifestCache = {};
    this.fileConfigDir = {};
  }

  private resolveConfigForFile(
    fileURL: URL,
    workingDir: string
  ): LookupConnection<Connection> | undefined {
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
      // TODO: if config was deleted, old connections in configLookups stay open until clearConfigCaches()
      return undefined;
    }

    // Record fileURL → configDir mapping for getBuildManifest
    this.fileConfigDir[fileURL.toString()] = result.configDir;

    // Update manifest cache if manifest text changed
    if (result.manifestText !== undefined) {
      const cached = this.manifestCache[result.configDir];
      if (!cached || cached.manifestText !== result.manifestText) {
        const manifest = new Manifest();
        manifest.loadText(result.manifestText);
        this.manifestCache[result.configDir] = {
          manifestText: result.manifestText,
          buildManifest: manifest.buildManifest,
        };
      }
    } else {
      delete this.manifestCache[result.configDir];
    }

    // Cache key includes working directory so files in different directories
    // get separate connection instances with correct workingDirectory.
    const cacheKey = `${result.configDir}::${workingDir}`;

    // Return cached lookup if the config text hasn't changed
    const cached = this.configLookups[cacheKey];
    if (cached && cached.configText === result.configText) {
      return cached.lookup;
    }

    // Close connections from the previous config before replacing
    if (cached) {
      this.closeConfigConnections(cached);
    }

    // Parse and create connections
    try {
      const malloyConfig = new MalloyConfig(result.configText);
      const map = injectWorkingDirectory(
        malloyConfig.connectionMap ?? {},
        workingDir
      );
      const innerLookup = connectionsFromMap(map);
      const connections: Connection[] = [];

      // Wrap the lookup to track every connection it creates
      const lookup: LookupConnection<Connection> = {
        lookupConnection: async (
          connectionName: string
        ): Promise<Connection> => {
          const conn = await innerLookup.lookupConnection(connectionName);
          if (!connections.includes(conn)) {
            connections.push(conn);
          }
          return conn;
        },
      };

      this.configLookups[cacheKey] = {
        lookup,
        configText: result.configText,
        connections,
      };
      return lookup;
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
    const configLookup = this.resolveConfigForFile(fileURL, workingDir);

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

    // Merged: config file takes precedence, settings as fallback
    const settingsLookup = this.getSettingsLookup(workingDir);
    if (configLookup && settingsLookup) {
      return new MergedConnectionLookup(configLookup, settingsLookup);
    }
    return configLookup ?? settingsLookup ?? this.emptyLookup();
  }

  public getBuildManifest(fileURL: URL): BuildManifest | undefined {
    const configDir = this.fileConfigDir[fileURL.toString()];
    return configDir ? this.manifestCache[configDir]?.buildManifest : undefined;
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
    console.info('Using connection config', connectionsConfig);

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

    if (this.secretResolver) {
      // Lazy resolution: secrets are resolved at lookupConnection() time.
      // SettingsConnectionLookup is lightweight (just holds references),
      // so creating one per call is fine.
      return new SettingsConnectionLookup(
        this.mergedSettingsConfig,
        this.secretResolver,
        workingDir
      );
    }

    // No resolver (e.g., browser) — create connections eagerly, cached per dir
    const cached = this.settingsLookupsByDir[workingDir];
    if (cached) return cached;

    const map = injectWorkingDirectory(
      this.mergedSettingsConfig as Record<string, ConnectionConfigEntry>,
      workingDir
    );
    try {
      const lookup = connectionsFromMap(map);
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

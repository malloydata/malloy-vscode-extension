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
  ConnectionsConfig,
  LookupConnection,
  readConnectionsConfig,
  createConnectionsFromConfig,
  getRegisteredConnectionTypes,
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
    private secretResolver: SecretResolver
  ) {}

  async lookupConnection(name: string): Promise<Connection> {
    const entry = this.config[name];
    if (!entry) throw new Error(`No connection named '${name}'`);

    const resolved = await this.resolveEntry(entry);

    const config: ConnectionsConfig = {connections: {[name]: resolved}};
    const lookup = createConnectionsFromConfig(config);
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

  /** New-format settings lookup (registry-based). */
  private settingsLookup: LookupConnection<Connection> | undefined;
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
  }

  private resolveConfigForFile(
    fileURL: URL
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

    // Return cached lookup if the config text hasn't changed
    const cached = this.configLookups[result.configDir];
    if (cached && cached.configText === result.configText) {
      return cached.lookup;
    }

    // Close connections from the previous config before replacing
    if (cached) {
      this.closeConfigConnections(cached);
    }

    // Parse and create connections
    try {
      const config = readConnectionsConfig(result.configText);
      const innerLookup = createConnectionsFromConfig(config);
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

      this.configLookups[result.configDir] = {
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
    const configLookup = this.resolveConfigForFile(fileURL);

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
    const settingsLookup = this.getSettingsLookup();
    if (configLookup && settingsLookup) {
      return new MergedConnectionLookup(configLookup, settingsLookup);
    }
    return configLookup ?? settingsLookup ?? this.emptyLookup();
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
    this.buildSettingsLookup(connectionsConfig);
  }

  private buildSettingsLookup(
    userConnections: Record<string, UnresolvedConnectionConfigEntry>
  ): void {
    // Merge defaults under user connections (user entries take precedence)
    const merged: Record<string, UnresolvedConnectionConfigEntry> = {
      ...getDefaultConnections(),
      ...userConnections,
    };

    if (this.secretResolver) {
      // Lazy resolution: secrets are resolved at lookupConnection() time
      this.settingsLookup = new SettingsConnectionLookup(
        merged,
        this.secretResolver
      );
    } else {
      // No resolver (e.g., browser) — create connections eagerly
      const config: ConnectionsConfig = {
        connections: merged as Record<string, ConnectionConfigEntry>,
      };
      try {
        this.settingsLookup = createConnectionsFromConfig(config);
      } catch (error) {
        console.warn(
          'Failed to create connections from settings config:',
          error
        );
        this.settingsLookup = undefined;
      }
    }
  }

  private getSettingsLookup(): LookupConnection<Connection> | undefined {
    return this.settingsLookup;
  }

  private emptyLookup(): LookupConnection<Connection> {
    return {
      lookupConnection: (name: string) =>
        Promise.reject(new Error(`No connection '${name}' configured`)),
    };
  }
}

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
  LookupConnection,
  TestableConnection,
  readConnectionsConfig,
  createConnectionsFromConfig,
} from '@malloydata/malloy';
import {
  ConfigOptions,
  ConnectionConfig,
} from './types/connection_manager_types';
import {ConnectionFactory} from './connections/types';

export class DynamicConnectionLookup implements LookupConnection<Connection> {
  connections: Record<string | symbol, Promise<Connection>> = {};

  constructor(
    private connectionFactory: ConnectionFactory,
    private configs: Record<string | symbol, ConnectionConfig>,
    private options: ConfigOptions
  ) {}

  async lookupConnection(connectionName: string): Promise<Connection> {
    const connectionKey = connectionName;
    if (!this.connections[connectionKey]) {
      const connectionConfig = this.configs[connectionKey];
      if (connectionConfig) {
        this.connections[connectionKey] =
          this.connectionFactory.getConnectionForConfig(connectionConfig, {
            useCache: true,
            ...this.options,
          });
      } else {
        throw new Error(`No connection found with name ${connectionName}`);
      }
    }
    return this.connections[connectionKey];
  }
}

export class CommonConnectionManager {
  private connectionLookups: Record<string, DynamicConnectionLookup> = {};
  private configList: ConnectionConfig[] = [];
  configMap: Record<string | symbol, ConnectionConfig> = {};
  connectionCache: Record<string | symbol, TestableConnection> = {};
  currentRowLimit = 50;
  workspaceRoots: string[] = [];

  // Cache: configDir -> parsed lookup + the configText it was parsed from
  private configLookups: Record<
    string,
    {lookup: LookupConnection<Connection>; configText: string}
  > = {};

  constructor(private connectionFactory: ConnectionFactory) {}

  public setWorkspaceRoots(roots: string[]): void {
    this.workspaceRoots = roots;
  }

  public clearConfigCaches(): void {
    this.configLookups = {};
  }

  public async connectionForConfig(
    connectionConfig: ConnectionConfig,
    options: ConfigOptions
  ): Promise<TestableConnection> {
    return this.connectionFactory.getConnectionForConfig(
      connectionConfig,
      options
    );
  }

  private resolveConfigForFile(
    fileURL: URL
  ): LookupConnection<Connection> | undefined {
    if (!this.connectionFactory.findMalloyConfig) {
      return undefined;
    }

    const result = this.connectionFactory.findMalloyConfig(
      fileURL,
      this.workspaceRoots
    );

    if (!result) {
      return undefined;
    }

    // Return cached lookup if the config text hasn't changed
    const cached = this.configLookups[result.configDir];
    if (cached && cached.configText === result.configText) {
      return cached.lookup;
    }

    // Parse and create connections
    try {
      const config = readConnectionsConfig(result.configText);
      const lookup = createConnectionsFromConfig(config);
      this.configLookups[result.configDir] = {
        lookup,
        configText: result.configText,
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
    // Try malloy-config.json first
    const configLookup = this.resolveConfigForFile(fileURL);
    if (configLookup) {
      return configLookup;
    }

    // Fall back to VS Code settings
    const workingDirectory =
      this.connectionFactory.getWorkingDirectory(fileURL);

    if (!this.connectionLookups[workingDirectory]) {
      this.connectionLookups[workingDirectory] = new DynamicConnectionLookup(
        this.connectionFactory,
        this.configMap,
        {
          workingDirectory,
          rowLimit: this.getCurrentRowLimit(),
        }
      );
    }
    return this.connectionLookups[workingDirectory];
  }

  public setCurrentRowLimit(rowLimit: number): void {
    this.currentRowLimit = rowLimit;
  }

  public getCurrentRowLimit(): number | undefined {
    return this.currentRowLimit;
  }

  public setConnectionsConfig(connectionsConfig: ConnectionConfig[]): void {
    // Force existing connections to be regenerated
    this.connectionFactory.reset();
    console.info('Using connection config', connectionsConfig);
    this.configList = connectionsConfig;
    this.buildConfigMap();
  }

  private buildConfigMap(): void {
    this.connectionLookups = {};
    this.connectionCache = {};
    this.clearConfigCaches();

    const configs = this.connectionFactory.addDefaults(this.configList);
    configs.forEach(config => {
      this.configMap[config.name] = config;
    });
  }
}

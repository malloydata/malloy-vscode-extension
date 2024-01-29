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
} from '@malloydata/malloy';
import {
  ConfigOptions,
  ConnectionConfig,
  ExternalConnectionConfig,
} from './types/connection_manager_types';
import {ConnectionFactory} from './connections/types';

const DEFAULT_CONFIG = Symbol('default-config');

export class DynamicConnectionLookup implements LookupConnection<Connection> {
  connections: Record<string | symbol, Promise<Connection>> = {};

  constructor(
    private connectionFactory: ConnectionFactory,
    private configs: Record<string | symbol, ConnectionConfig>,
    private options: ConfigOptions
  ) {}

  async lookupConnection(
    connectionName?: string | undefined
  ): Promise<Connection> {
    const connectionKey = connectionName || DEFAULT_CONFIG;
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

export class ConnectionManager {
  private connectionLookups: Record<string, DynamicConnectionLookup> = {};
  configMap: Record<string | symbol, ConnectionConfig> = {};
  connectionCache: Record<string | symbol, TestableConnection> = {};
  currentRowLimit = 50;

  constructor(
    private connectionFactory: ConnectionFactory,
    private configList: ConnectionConfig[]
  ) {
    this.buildConfigMap();
  }

  public setConnectionsConfig(connectionsConfig: ConnectionConfig[]): void {
    // Force existing connections to be regenerated
    console.info('Using connection config', connectionsConfig);
    this.configList = connectionsConfig;
    this.buildConfigMap();
    this.connectionFactory.reset();
  }

  public async connectionForConfig(
    connectionConfig: ConnectionConfig
  ): Promise<TestableConnection> {
    return this.connectionFactory.getConnectionForConfig(connectionConfig, {
      workingDirectory: '/',
    });
  }

  public getConnectionLookup(fileURL: URL): LookupConnection<Connection> {
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

  public getAllConnectionConfigs() {
    return this.configList;
  }

  public getConnectionConfigs() {
    return this.filterUnavailableConnectionBackends(this.configList);
  }

  public async installExternalConnectionPackage(
    connectionConfig: ExternalConnectionConfig
  ): Promise<ExternalConnectionConfig> {
    return this.connectionFactory.installExternalConnectionPackage(
      connectionConfig
    );
  }

  public getAvailableBackends() {
    return this.connectionFactory.getAvailableBackends();
  }

  protected filterUnavailableConnectionBackends(
    connectionsConfig: ConnectionConfig[]
  ): ConnectionConfig[] {
    const availableBackends = this.connectionFactory.getAvailableBackends();
    return connectionsConfig.filter(config =>
      availableBackends.includes(config.backend)
    );
  }

  private buildConfigMap(): void {
    this.connectionLookups = {};
    this.connectionCache = {};

    const configs = this.connectionFactory.addDefaults(this.configList);
    configs.forEach(config => {
      if (config.isDefault) {
        this.configMap[DEFAULT_CONFIG] = config;
      }
      this.configMap[config.name] = config;
    });
  }
}

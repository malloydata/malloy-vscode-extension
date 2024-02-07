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

import {TestableConnection} from '@malloydata/malloy';
import {ConnectionFactory} from '../types';
import {
  ConfigOptions,
  ConnectionBackend,
  ConnectionConfig,
  ExternalConnectionConfig,
} from '../../types/connection_manager_types';
import {createDuckDbWasmConnection} from '../duckdb_wasm_connection';
import {DuckDBWASMConnection} from '@malloydata/db-duckdb/wasm';

export type FetchCallback = (uri: string) => Promise<Uint8Array>;

export class WebConnectionFactory implements ConnectionFactory {
  connectionCache: Record<string, TestableConnection> = {};

  constructor(private fetchBinaryFile?: FetchCallback) {}

  installExternalConnectionPackage(
    _connectionConfig: ExternalConnectionConfig
  ): Promise<ExternalConnectionConfig> {
    throw new Error(
      'Can not install external packages in the browser for now.'
    );
  }

  async reset() {
    await Promise.all(
      Object.values(this.connectionCache).map(connection => connection.close())
    );
    this.connectionCache = {};
  }

  getAvailableBackends(): ConnectionBackend[] {
    return [ConnectionBackend.DuckDB];
  }

  async getConnectionForConfig(
    connectionConfig: ConnectionConfig,
    configOptions: ConfigOptions = {}
  ): Promise<TestableConnection> {
    const {useCache, workingDirectory} = configOptions;
    const cacheKey = `${connectionConfig.name}::${workingDirectory}`;
    let connection: TestableConnection | undefined;
    if (useCache && this.connectionCache[cacheKey]) {
      return this.connectionCache[cacheKey];
    }
    switch (connectionConfig.backend) {
      case ConnectionBackend.DuckDB:
        {
          const remoteTableCallback = async (tableName: string) => {
            if (this.fetchBinaryFile) {
              const url = new URL(tableName, workingDirectory);
              return this.fetchBinaryFile(url.toString());
            }
            return undefined;
          };
          const duckDBConnection: DuckDBWASMConnection =
            await createDuckDbWasmConnection(connectionConfig, configOptions);
          duckDBConnection.registerRemoteTableCallback(remoteTableCallback);
          connection = duckDBConnection;
        }
        break;
    }
    if (useCache && connection) {
      this.connectionCache[cacheKey] = connection;
    }
    if (!connection) {
      throw new Error(
        `Unsupported connection back end "${connectionConfig.backend}"`
      );
    }

    return connection;
  }

  getWorkingDirectory(url: URL): string {
    try {
      const baseUrl = new URL('.', url);
      return baseUrl.toString();
    } catch {
      return url.toString();
    }
  }

  addDefaults(configs: ConnectionConfig[]): ConnectionConfig[] {
    // Create a default duckdb connection if one isn't configured
    if (!configs.find(config => config.name === 'duckdb')) {
      configs.push({
        name: 'duckdb',
        backend: ConnectionBackend.DuckDB,
        id: 'duckdb-default',
        isGenerated: true,
      });
    }
    return configs;
  }
}

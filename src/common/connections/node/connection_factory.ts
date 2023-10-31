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
} from '../../connection_manager_types';
import {createBigQueryConnection} from '../bigquery_connection';
import {createDuckDbConnection} from '../duckdb_connection';
import {createPostgresConnection} from '../postgres_connection';
import {isDuckDBAvailable} from '../../duckdb_availability';

import {fileURLToPath} from 'url';
import {ExternalConnectionFactory} from '../external_connection_factory';

export class DesktopConnectionFactory implements ConnectionFactory {
  connectionCache: Record<string, TestableConnection> = {};
  externalConnectionFactory = new ExternalConnectionFactory();

  reset() {
    Object.values(this.connectionCache).forEach(connection =>
      connection.close()
    );
    this.connectionCache = {};
  }

  getAvailableBackends(): ConnectionBackend[] {
    const available = [
      ConnectionBackend.BigQuery,
      ConnectionBackend.Postgres,
      ConnectionBackend.External,
    ];
    if (isDuckDBAvailable) {
      available.push(ConnectionBackend.DuckDB);
    }
    return available;
  }

  async getConnectionForConfig(
    connectionConfig: ConnectionConfig,
    configOptions: ConfigOptions = {
      workingDirectory: '/',
    }
  ): Promise<TestableConnection> {
    const {useCache, workingDirectory} = configOptions;
    const cacheKey = `${connectionConfig.name}::${workingDirectory}`;

    let connection: TestableConnection | undefined;
    if (useCache && this.connectionCache[cacheKey]) {
      return this.connectionCache[cacheKey];
    }
    switch (connectionConfig.backend) {
      case ConnectionBackend.BigQuery:
        connection = await createBigQueryConnection(
          connectionConfig,
          configOptions
        );
        break;
      case ConnectionBackend.Postgres: {
        connection = await createPostgresConnection(
          connectionConfig,
          configOptions
        );
        break;
      }
      case ConnectionBackend.DuckDB: {
        connection = await createDuckDbConnection(
          connectionConfig,
          configOptions
        );
        break;
      }
      case ConnectionBackend.External: {
        connection = await this.externalConnectionFactory.createOtherConnection(
          connectionConfig
        );
        break;
      }
    }
    if (useCache && connection) {
      this.connectionCache[cacheKey] = connection;
    }
    if (!connection) {
      throw new Error(
        `Unsupported connection back end "${connectionConfig.backend}"`
      );
    }

    console.info(
      'Created',
      connectionConfig.backend,
      'connection:',
      connectionConfig.name
    );

    return connection;
  }

  async installExternalConnectionPackage(
    connectionConfig: ExternalConnectionConfig
  ): Promise<ExternalConnectionConfig> {
    const packageInfo =
      await this.externalConnectionFactory.installExternalConnectionPackage(
        connectionConfig
      );
    const connectionSpec =
      await this.externalConnectionFactory.fetchConnectionFactory(packageInfo);
    return {
      ...connectionConfig,
      packageInfo: packageInfo,
      name: connectionSpec.connectionName,
      connectionSchema: connectionSpec.configSchema,
    };
  }

  getWorkingDirectory(url: URL): string {
    try {
      const baseUrl = new URL('.', url);
      const fileUrl = new URL(baseUrl.pathname, 'file:');
      return fileURLToPath(fileUrl);
    } catch {
      return '.';
    }
  }

  addDefaults(configs: ConnectionConfig[]): ConnectionConfig[] {
    // Create a default bigquery connection if one isn't configured
    if (
      !configs.find(config => config.backend === ConnectionBackend.BigQuery)
    ) {
      configs.push({
        name: 'bigquery',
        backend: ConnectionBackend.BigQuery,
        id: 'bigquery-default',
        isDefault: !configs.find(config => config.isDefault),
        isGenerated: true,
      });
    }

    // Create a default duckdb connection if one isn't configured
    if (!configs.find(config => config.name === 'duckdb')) {
      configs.push({
        name: 'duckdb',
        backend: ConnectionBackend.DuckDB,
        id: 'duckdb-default',
        isDefault: false,
        isGenerated: true,
      });
    }
    return configs;
  }
}

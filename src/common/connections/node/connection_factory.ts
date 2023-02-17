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

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {TestableConnection} from '@malloydata/malloy';
import {ConnectionFactory} from '../types';
import {
  BigQueryConnectionConfig,
  ConfigOptions,
  ConnectionBackend,
  ConnectionBackendNames,
  ConnectionConfig,
  DuckDBConnectionConfig,
  ExternalConnection,
  PostgresConnectionConfig,
} from '../../connection_manager_types';
import {createBigQueryConnection} from '../bigquery_connection';
import {createDuckDbConnection} from '../duckdb_connection';
import {createPostgresConnection} from '../postgres_connection';
import {isDuckDBAvailable} from '../../duckdb_availability';

import {fileURLToPath} from 'url';

export class DesktopConnectionFactory implements ConnectionFactory {
  private connectionCache: Record<string, TestableConnection> = {};
  private _externalConnections: Record<string, ExternalConnection> | undefined;

  reset() {
    Object.values(this.connectionCache).forEach(connection =>
      connection.close()
    );
    this.connectionCache = {};
  }

  async getAvailableBackends(): Promise<Array<ConnectionBackend | string>> {
    const available: Array<ConnectionBackend | string> = [
      ConnectionBackend.BigQuery,
      ConnectionBackend.Postgres,
    ];
    if (isDuckDBAvailable) {
      available.push(ConnectionBackend.DuckDB);
    }
    const externalConnections = await this.getExternalConnections();
    for (const backend of Object.keys(externalConnections)) {
      available.push(backend);
    }
    return available;
  }

  async getExternalConnections(): Promise<Record<string, ExternalConnection>> {
    if (!this._externalConnections) {
      this._externalConnections = this.loadExternalConnections();
    }
    return this._externalConnections;
  }

  async getConnectionForConfig(
    connectionConfig: ConnectionConfig,
    configOptions: ConfigOptions = {
      workingDirectory: '/',
    }
  ): Promise<TestableConnection> {
    const {useCache, workingDirectory} = configOptions;
    const {name, backend} = connectionConfig;
    const cacheKey = `${name}::${workingDirectory}`;

    let connection: TestableConnection;
    if (useCache && this.connectionCache[cacheKey]) {
      return this.connectionCache[cacheKey];
    }
    switch (connectionConfig.backend) {
      case ConnectionBackend.BigQuery:
        connection = await createBigQueryConnection(
          connectionConfig as BigQueryConnectionConfig,
          configOptions
        );
        break;
      case ConnectionBackend.Postgres: {
        connection = await createPostgresConnection(
          connectionConfig as PostgresConnectionConfig,
          configOptions
        );
        break;
      }
      case ConnectionBackend.DuckDB: {
        connection = await createDuckDbConnection(
          connectionConfig as DuckDBConnectionConfig,
          configOptions
        );
        break;
      }
      default: {
        const externalConnections = await this.getExternalConnections();
        if (externalConnections[backend]) {
          if (!externalConnections[backend].bundle) {
            throw new Error(`${backend}: Missing bundle path`);
          }
          const {createConnection} = await import(
            externalConnections[backend].bundle
          );
          if (!createConnection) {
            throw new Error(
              `${backend}: Missing createConnection() entry point`
            );
          }
          connection = createConnection(connectionConfig, configOptions);
        } else {
          throw new Error(`${backend}: Not available`);
        }
      }
    }
    if (useCache) {
      this.connectionCache[cacheKey] = connection;
    }

    return connection;
  }

  getWorkingDirectory(url: URL): string {
    const baseUrl = new URL('.', url);
    const fileUrl = new URL(baseUrl.pathname, 'file:');
    return fileURLToPath(fileUrl);
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

  loadExternalConnections(): Record<string, ExternalConnection> {
    const malloyDir = path.join(os.homedir(), '.malloy', 'extensions');
    const results: Record<string, ExternalConnection> = {};
    try {
      const modules = fs.readdirSync(malloyDir);
      for (const module of modules) {
        const packageDir = path.join(malloyDir, module);
        const packageFile = path.join(packageDir, 'package.json');
        try {
          const packageJson = fs.readFileSync(packageFile, 'utf8');
          const packageData = JSON.parse(packageJson);
          const contributes = packageData.contributes;
          if (contributes?.connection) {
            let {name, title} = contributes.connection;
            if (!name) {
              name = packageData.name;
            }
            if (!title) {
              title = name;
            }
            results[name] = {
              ...contributes?.connection,
              bundle: path.join(packageDir, packageData.main),
              name,
              title,
            };
            ConnectionBackendNames[name] = title;
          }
        } catch {
          console.warn(`Error reading ${packageFile}`);
        }
      }
    } catch {
      console.info('Cannot read malloy extensions directory');
    }
    return results;
  }
}

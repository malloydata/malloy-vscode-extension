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
import {ConnectionFactory} from '../../../common/connections/types';
import {
  ConfigOptions,
  ConnectionBackend,
  ConnectionConfig,
} from '../../../common/types/connection_manager_types';
import {createBigQueryConnection} from '../bigquery_connection';
import {createDuckDbConnection} from '../duckdb_connection';
import {createPostgresConnection} from '../postgres_connection';
import {createSnowflakeConnection} from '../snowflake_connection';
import {createTrinoConnection} from '../trino_connection';

import {fileURLToPath} from 'url';
import {GenericConnection} from '../../../common/types/worker_message_types';
import {TrinoExecutor} from '@malloydata/db-trino';

export class NodeConnectionFactory implements ConnectionFactory {
  connectionCache: Record<string, TestableConnection> = {};

  constructor(private client: GenericConnection) {}

  reset() {
    Object.values(this.connectionCache).forEach(connection =>
      connection.close()
    );
    this.connectionCache = {};
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
      case ConnectionBackend.BigQuery:
        connection = await createBigQueryConnection(
          connectionConfig,
          configOptions
        );
        break;
      case ConnectionBackend.Postgres: {
        connection = await createPostgresConnection(
          this.client,
          connectionConfig,
          configOptions
        );
        break;
      }
      case ConnectionBackend.DuckDB: {
        connection = await createDuckDbConnection(
          this.client,
          connectionConfig,
          configOptions
        );
        break;
      }
      case ConnectionBackend.Snowflake: {
        connection = await createSnowflakeConnection(
          this.client,
          connectionConfig,
          configOptions
        );
        break;
      }
      case ConnectionBackend.Trino: {
        connection = await createTrinoConnection();
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
      });
    }

    // Create a default duckdb connection if one isn't configured
    if (!configs.find(config => config.name === 'duckdb')) {
      configs.push({
        name: 'duckdb',
        backend: ConnectionBackend.DuckDB,
        id: 'duckdb-default',
      });
    }

    // Create a default motherduck connection if one isn't configured
    if (!configs.find(config => config.name === 'md')) {
      configs.push({
        name: 'md',
        backend: ConnectionBackend.DuckDB,
        id: 'motherduck-default',
      });
    }

    if (!configs.find(config => config.backend === ConnectionBackend.Trino)) {
      try {
        /*const trinoOptions = TrinoExecutor.getConnectionOptionsFromEnv();
        if (trinoOptions !== null) {*/
        // TODO(figutierrez): add default.
        configs.push({
          name: 'trino',
          backend: ConnectionBackend.Trino,
          id: 'trino-default',
        });
        //}
      } catch (error) {
        console.info(
          `Could not get connection options for Trino connection. ${error}`
        );
      }
    }
    return configs;
  }
}

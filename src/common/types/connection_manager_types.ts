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

export enum ConnectionBackend {
  BigQuery = 'bigquery',
  Postgres = 'postgres',
  DuckDB = 'duckdb',
  Snowflake = 'snowflake',
  Trino = 'trino',
  Presto = 'presto',
  MySQL = 'mysql',
  Publisher = 'publisher',
}

export const ConnectionBackendNames: Record<ConnectionBackend, string> = {
  [ConnectionBackend.BigQuery]: 'BigQuery',
  [ConnectionBackend.Postgres]: 'Postgres',
  [ConnectionBackend.MySQL]: 'MySQL',
  [ConnectionBackend.DuckDB]: 'DuckDB',
  // TODO(whscullin): Remove beta once ready.
  [ConnectionBackend.Snowflake]: 'Snowflake (Beta)',
  [ConnectionBackend.Trino]: 'Trino',
  [ConnectionBackend.Presto]: 'Presto',
  [ConnectionBackend.Publisher]: 'Publisher',
};

/*
 * NOTE: These should be kept in sync with the "malloy.connections"
 * section of the extension "configuration" definition in package.json
 */

export interface BaseConnectionConfig {
  name: string;
  id: string;
}

export interface BigQueryConnectionConfig extends BaseConnectionConfig {
  backend: ConnectionBackend.BigQuery;
  serviceAccountKeyPath?: string;
  projectId?: string;
  billingProjectId?: string;
  location?: string;
  maximumBytesBilled?: string;
  timeoutMs?: string;
}

export interface PostgresConnectionConfig extends BaseConnectionConfig {
  backend: ConnectionBackend.Postgres;
  username?: string;
  password?: string;
  host?: string;
  port?: number;
  databaseName?: string;
  connectionString?: string;
}

export interface MysqlConnectionConfig extends BaseConnectionConfig {
  backend: ConnectionBackend.MySQL;
  user?: string;
  password?: string;
  host?: string;
  port?: number;
  database?: string;
}

export interface DuckDBConnectionConfig extends BaseConnectionConfig {
  additionalExtensions?: string[];
  backend: ConnectionBackend.DuckDB;
  workingDirectory?: string;
  databasePath?: string;
  motherDuckToken?: string;
}

export interface SnowflakeConnectionConfig extends BaseConnectionConfig {
  backend: ConnectionBackend.Snowflake;
  account?: string;
  username?: string;
  password?: string;
  warehouse?: string;
  database?: string;
  schema?: string;
  timeoutMs?: number;
}

// Note: These options are identical to the TrinoConnectionConfig, except the value of 'backend'.
// This is because they ultimately rout to a shared connection: `TrinoPrestoConnection`.
// This should not be exported because it is only used below.
interface TrinoPrestoPartialConnectionConfig extends BaseConnectionConfig {
  // For a Presto connnection, 'server' is just the host (ex: http://localhost),
  // but for a Trino connection, 'server' includes port information
  server?: string;
  port?: number;
  catalog?: string;
  schema?: string;
  user?: string;
  password?: string;
}

export interface TrinoConnectionConfig
  extends TrinoPrestoPartialConnectionConfig {
  backend: ConnectionBackend.Trino;
}

export interface PrestoConnectionConfig
  extends TrinoPrestoPartialConnectionConfig {
  backend: ConnectionBackend.Presto;
}

export interface PublisherConnectionConfig extends BaseConnectionConfig {
  backend: ConnectionBackend.Publisher;
  connectionUri?: string;
  accessToken?: string;
  readOnly?: boolean;
}

export type ConnectionConfig =
  | BigQueryConnectionConfig
  | PostgresConnectionConfig
  | DuckDBConnectionConfig
  | SnowflakeConnectionConfig
  | TrinoConnectionConfig
  | PrestoConnectionConfig
  | MysqlConnectionConfig
  | PublisherConnectionConfig;

export interface ConfigOptions {
  workingDirectory?: string;
  rowLimit?: number;
  useCache?: boolean;
  useKeyStore?: boolean;
}

export interface ConnectionConfigManager {
  getAllConnectionConfigs(): ConnectionConfig[];
  getAvailableBackends(): ConnectionBackend[];
  getConnectionConfigs(): ConnectionConfig[];
  onConfigurationUpdated(): Promise<void>;
}

export interface ConnectionManager {
  connectionForConfig(
    connectionConfig: ConnectionConfig,
    options: ConfigOptions
  ): Promise<TestableConnection>;
  getConnectionLookup(fileURL: URL): LookupConnection<Connection>;
  setConnectionsConfig(connectionsConfig: ConnectionConfig[]): void;
}

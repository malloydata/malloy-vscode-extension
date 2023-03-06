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

export enum ConnectionBackend {
  BigQuery = 'bigquery',
  Postgres = 'postgres',
  DuckDB = 'duckdb',
  DuckDBWASM_DEPRECATED = 'duckdb_wasm',
}

export const ConnectionBackendNames: Record<ConnectionBackend, string> = {
  [ConnectionBackend.BigQuery]: 'BigQuery',
  [ConnectionBackend.Postgres]: 'Postgres',
  [ConnectionBackend.DuckDB]: 'DuckDB',
  [ConnectionBackend.DuckDBWASM_DEPRECATED]: 'duckdDuckDBb_wasm',
};

/*
 * NOTE: These should be kept in sync with the "malloy.connections"
 * section of the extension "configuration" definition in package.json
 */

export interface BaseConnectionConfig {
  name: string;
  isDefault: boolean;
  id: string;
  isGenerated?: boolean; // Not part of VS Code configuration
}

export interface BigQueryConnectionConfig extends BaseConnectionConfig {
  backend: ConnectionBackend.BigQuery;
  serviceAccountKeyPath?: string;
  projectName?: string;
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
  useKeychainPassword?: boolean;
}

export interface DuckDBConnectionConfig extends BaseConnectionConfig {
  backend: ConnectionBackend.DuckDB;
  workingDirectory?: string;
}

export interface DuckDBWASMConnectionConfigDeprecated
  extends BaseConnectionConfig {
  backend: ConnectionBackend.DuckDBWASM_DEPRECATED;
  workingDirectory?: string;
}

export type ConnectionConfig =
  | BigQueryConnectionConfig
  | PostgresConnectionConfig
  | DuckDBConnectionConfig
  | DuckDBWASMConnectionConfigDeprecated;

export interface ConfigOptions {
  workingDirectory: string;
  rowLimit?: number;
  useCache?: boolean;
}

/**
 * Return the index of the connection that should be treated as
 * the default.
 *
 * @param connections
 * @returns The index of the first connection with `isDefault === true`,
 *          or else 0 (if there is any connection), or else `undefined`.
 */
export function getDefaultIndex(
  connections: ConnectionConfig[]
): number | undefined {
  const index = connections.findIndex(connection => connection.isDefault);
  if (index === -1) {
    if (connections.length >= 1) {
      return 0;
    } else {
      return undefined;
    }
  }
  return index;
}

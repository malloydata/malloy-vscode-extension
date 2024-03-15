/*
 * Copyright 2024 Google LLC
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

import * as vscode from 'vscode';
import {getMalloyConfig} from '../utils/config';
import {
  ConnectionBackend,
  ConnectionConfig,
} from '../../common/types/connection_manager_types';

/**
 * Create the default connections, duckdb, bigquery and motherduck (md)
 * If force is true, all connections are recreated if they are missing,
 * if false, only connections that have not been created before are
 * created.
 *
 * @param context VS Code extension context
 * @param force Re-create if the user has created and deleted
 */
export async function createDefaultConnections(
  context: vscode.ExtensionContext,
  force = true
): Promise<void> {
  const malloyConfig = getMalloyConfig();
  const connectionConfigs = malloyConfig.get(
    'connections'
  ) as ConnectionConfig[];
  for (const defaultConnection of DEFAULT_CONNECTIONS) {
    if (
      !connectionConfigs.find(
        connection => connection.name === defaultConnection.name
      )
    ) {
      const key = `malloy_created_default.${defaultConnection.name}`;
      const alreadyCreated = context.globalState.get(key);
      if (force || !alreadyCreated) {
        connectionConfigs.push(defaultConnection);
        await context.globalState.update(key, true);
      }
    }
  }
  await malloyConfig.update('connections', connectionConfigs, true);
}

const DEFAULT_CONNECTIONS: ConnectionConfig[] = [
  {
    name: 'bigquery',
    backend: ConnectionBackend.BigQuery,
    id: 'bigquery-default',
  },
  {
    name: 'duckdb',
    backend: ConnectionBackend.DuckDB,
    id: 'duckdb-default',
  },
  {
    name: 'md',
    backend: ConnectionBackend.DuckDB,
    id: 'motherduck-default',
    databasePath: 'md:',
  },
] as const;

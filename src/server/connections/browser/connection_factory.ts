/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/db-duckdb/browser';
import {Connection} from '@malloydata/malloy';
import {DuckDBWASMConnection} from '@malloydata/db-duckdb/wasm';
import {ConnectionFactory} from '../../../common/connections/types';
import {GenericConnection} from '../../../common/types/worker_message_types';
import {errorMessage} from '../../../common/errors';

export class WebConnectionFactory implements ConnectionFactory {
  private registeredConnections = new WeakSet<Connection>();

  constructor(private client: GenericConnection) {}

  reset() {
    // No-op: connections are now created fresh per-operation via the registry.
  }

  getWorkingDirectory(url: URL): string {
    try {
      const baseUrl = new URL('.', url);
      return baseUrl.toString();
    } catch {
      return url.toString();
    }
  }

  postProcessConnection(conn: Connection, workingDir: string): void {
    if (this.registeredConnections.has(conn)) return;
    if (!(conn instanceof DuckDBWASMConnection)) return;

    conn.registerRemoteTableCallback(async (tableName: string) => {
      const url = new URL(tableName, workingDir);
      try {
        return await this.client.sendRequest('malloy/fetchBinaryFile', {
          uri: url.toString(),
        });
      } catch (error) {
        console.error(
          `fetchBinaryFile: unable to load '${url}': ${errorMessage(error)}`
        );
        return undefined;
      }
    });

    this.registeredConnections.add(conn);
  }
}

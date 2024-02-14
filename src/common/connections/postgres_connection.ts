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

import {PostgresConnection} from '@malloydata/db-postgres';
import {
  PostgresConnectionConfig,
  ConfigOptions,
} from '../types/connection_manager_types';
import {GenericConnection} from '../types/worker_message_types';

export const createPostgresConnection = async (
  client: GenericConnection,
  connectionConfig: PostgresConnectionConfig,
  {rowLimit, useKeyStore}: ConfigOptions
): Promise<PostgresConnection> => {
  useKeyStore ??= true;
  const {username, host, port, databaseName, connectionString} =
    connectionConfig;
  const options = {
    username,
    host,
    port,
    databaseName,
    connectionString,
  };
  const configReader = async () => {
    let password: string | undefined;
    if (useKeyStore) {
      password = await client.sendRequest('malloy/getSecret', {
        key: `connections.${connectionConfig.id}.password`,
      });
    } else if (connectionConfig.password !== undefined) {
      password = connectionConfig.password;
    }
    return {
      ...options,
      password,
    };
  };
  console.info('Creating postgres connection with', JSON.stringify(options));
  const connection = new PostgresConnection(
    connectionConfig.name,
    () => ({rowLimit}),
    configReader
  );
  return connection;
};

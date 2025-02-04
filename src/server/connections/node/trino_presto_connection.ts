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

import {PrestoConnection, TrinoConnection} from '@malloydata/db-trino';
import {
  ConfigOptions,
  PrestoConnectionConfig,
  TrinoConnectionConfig,
} from '../../../common/types/connection_manager_types';
import {GenericConnection} from '../../../common/types/worker_message_types';

export const createTrinoPrestoConnection = async (
  client: GenericConnection,
  connectionConfig: TrinoConnectionConfig | PrestoConnectionConfig,
  {rowLimit, useKeyStore}: ConfigOptions
): Promise<PrestoConnection | TrinoConnection> => {
  useKeyStore ??= true;
  const config = {...connectionConfig};

  if (useKeyStore) {
    config.password = await client.sendRequest('malloy/getSecret', {
      key: `connections.${connectionConfig.id}.password`,
    });
  }

  const sanitizedConfig = {...config};
  sanitizedConfig.password = sanitizedConfig.password ? '***' : '';
  console.info(
    `Creating ${connectionConfig.id} connection with`,
    JSON.stringify(sanitizedConfig)
  );
  const TrinoPrestoContructor = connectionConfig.id === 'presto' ? PrestoConnection : TrinoConnection;
  const connection = new TrinoPrestoContructor(
    connectionConfig.id,
    () => ({rowLimit}),
    connectionConfig
  );
  return connection;
};

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

import {DuckDBConnection} from '@malloydata/db-duckdb';
import {
  ConfigOptions,
  GizmoSQLConnectionConfig,
} from '../../../common/types/connection_manager_types';
import {GenericConnection} from '../../../common/types/worker_message_types';

export const createGizmoSQLConnection = async (
  client: GenericConnection,
  connectionConfig: GizmoSQLConnectionConfig,
  {rowLimit, useKeyStore}: ConfigOptions
) => {
  useKeyStore ??= true;
  try {
    const {name} = connectionConfig;

    let gizmosqlPassword = connectionConfig.gizmosqlPassword;
    if (useKeyStore && connectionConfig.gizmosqlUri) {
      gizmosqlPassword = await client.sendRequest('malloy/getSecret', {
        key: `connections.${connectionConfig.id}.gizmosqlPassword`,
        promptIfMissing: 'Enter your GizmoSQL password:',
      });
    }

    const options = {
      name,
      // GizmoSQL Flight SQL options
      useGizmoSQL: true,
      gizmosqlUri: connectionConfig.gizmosqlUri,
      gizmosqlUsername: connectionConfig.gizmosqlUsername,
      gizmosqlPassword,
      gizmosqlCatalog: connectionConfig.gizmosqlCatalog,
    };
    console.info(
      'Creating GizmoSQL connection with',
      JSON.stringify({
        ...options,
        gizmosqlPassword: options.gizmosqlPassword ? '[REDACTED]' : undefined,
      })
    );
    const connection = new DuckDBConnection(options, () => ({rowLimit}));
    return connection;
  } catch (error) {
    console.error('Could not create GizmoSQL connection:', error);
    throw error;
  }
};

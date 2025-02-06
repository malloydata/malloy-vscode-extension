/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {PrestoConnection, TrinoConnection} from '@malloydata/db-trino';
import {
  ConfigOptions,
  ConnectionBackend,
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

  if (connectionConfig.backend === ConnectionBackend.Presto) {
    const connection = new PrestoConnection(
      connectionConfig.name,
      () => ({rowLimit}),
      connectionConfig
    );
    return connection;
  } else if (connectionConfig.backend === ConnectionBackend.Trino) {
    const connection = new TrinoConnection(
      connectionConfig.name,
      () => ({rowLimit}),
      connectionConfig
    );
    return connection;
  } else {
    throw new Error('Invalid backend provided.');
  }
};

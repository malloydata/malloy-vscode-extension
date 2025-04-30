/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {PublisherConnection} from '@malloydata/db-publisher';
import {PublisherConnectionConfig} from '../../../common/types/connection_manager_types';
import {GenericConnection} from '../../../common/types/worker_message_types';

export const createPublisherConnection = async (
  client: GenericConnection,
  connectionConfig: PublisherConnectionConfig
): Promise<PublisherConnection> => {
  const {connectionUri, accessToken} = connectionConfig;
  if (!connectionUri) {
    throw new Error('Connection URI is required');
  }

  const options = {
    connectionUri,
    accessToken,
  };
  console.info('Creating publisher connection with', options);
  const connection = await PublisherConnection.create(
    connectionConfig.name,
    options
  );
  return connection;
};

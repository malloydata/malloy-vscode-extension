/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {PublisherConnection} from '@malloydata/db-publisher';
import {
  ConfigOptions,
  PublisherConnectionConfig,
} from '../../../common/types/connection_manager_types';
import {GenericConnection} from '../../../common/types/worker_message_types';

export const createPublisherConnection = async (
  client: GenericConnection,
  connectionConfig: PublisherConnectionConfig,
  configOptions: ConfigOptions
): Promise<PublisherConnection> => {
  const {connectionUri, accessToken} = connectionConfig;

  if (!connectionUri) {
    throw new Error('Connection URI is required');
  }
  // Maybe we will use configOptions in the future?
  console.info('PublisherConnection is not using configOptions', configOptions);

  const options = {
    connectionUri,
    accessToken,
  };
  console.info('Creating publisher connection with', options);
  const connection = new PublisherConnection(connectionConfig.name, options);
  // TODO: call async init method if needed
  return connection;
};

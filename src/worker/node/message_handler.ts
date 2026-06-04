/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {downloadQuery} from './download_query';
import {ConnectionManager} from '../../common/types/connection_manager_types';
import {MessageHandler} from '../message_handler';
import {inspect} from 'node:util';
import {GenericConnection} from '../../common/types/worker_message_types';

export class NodeMessageHandler {
  messageHandler: MessageHandler;

  constructor(
    connection: GenericConnection,
    connectionManager: ConnectionManager
  ) {
    this.messageHandler = new MessageHandler(connection, connectionManager);

    this.messageHandler.onRequest(
      'malloy/download',
      (message, cancellationToken) =>
        downloadQuery(
          this.messageHandler,
          connectionManager,
          message,
          this.messageHandler.fileHandler,
          cancellationToken
        )
    );
    this.messageHandler.log('NodeMessageHandler initialized.');
  }

  log = (...args: unknown[]) => {
    this.messageHandler.log(
      args.map(arg => (typeof arg === 'string' ? arg : inspect(arg))).join(' ')
    );
  };
}

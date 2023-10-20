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

import * as rpc from 'vscode-jsonrpc/node';
import {downloadQuery} from './download_query';
import {ConnectionManager} from '../../common/connection_manager';
import {DesktopConnectionFactory} from '../../common/connections/node/connection_factory';
import {MessageHandler} from '../message_handler';
import {refreshConfig} from './refresh_config';
import {inspect} from 'node:util';

export class NodeMessageHandler {
  messageHandler: MessageHandler;

  constructor() {
    const connection = rpc.createMessageConnection(
      new rpc.IPCMessageReader(process),
      new rpc.IPCMessageWriter(process)
    );
    connection.listen();

    const connectionManager = new ConnectionManager(
      new DesktopConnectionFactory(),
      []
    );

    this.messageHandler = new MessageHandler(connection, connectionManager);

    this.messageHandler.onRequest('malloy/download', message =>
      downloadQuery(
        this.messageHandler,
        connectionManager,
        message,
        this.messageHandler.fileHandler
      )
    );
    this.messageHandler.onRequest('malloy/config', message =>
      refreshConfig(connectionManager, message)
    );
    this.messageHandler.log('NodeMessageHandler initialized.');
  }

  log = (...args: unknown[]) => {
    this.messageHandler.log(
      args.map(arg => (typeof arg === 'string' ? arg : inspect(arg))).join(' ')
    );
  };
}

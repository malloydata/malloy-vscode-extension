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

import * as rpc from 'vscode-jsonrpc/browser';
import {ConnectionManager} from '../../common/connection_manager';
import {WebConnectionFactory} from '../../common/connections/browser/connection_factory';
import {MessageHandler} from '../message_handler';
import {RpcFileHandler} from '../file_handler';

export class BrowserMessageHandler {
  constructor() {
    const connection = rpc.createMessageConnection(
      new rpc.BrowserMessageReader(self),
      new rpc.BrowserMessageWriter(self)
    );
    connection.listen();

    const connectionManager = new ConnectionManager(
      new WebConnectionFactory(uri => fileHandler.fetchBinaryFile(uri)),
      []
    );

    const fileHandler = new RpcFileHandler(connection);

    const messageHandler = new MessageHandler(
      connection,
      connectionManager,
      fileHandler
    );

    messageHandler.log('Worker started');
  }
}

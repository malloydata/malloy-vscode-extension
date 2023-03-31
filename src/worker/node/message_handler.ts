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
import {cancelQuery, runQuery} from '../run_query';
import {downloadQuery} from './download_query';
import {
  MessageCancel,
  MessageConfig,
  MessageDownload,
  MessageHandler,
  MessageRun,
  WorkerLogMessage,
  WorkerMessage,
} from '../../common/worker_message_types';
import {refreshConfig} from '../refresh_config';
import {ConnectionManager} from '../../common/connection_manager';
import {DesktopConnectionFactory} from '../../common/connections/node/connection_factory';

import {FileHandler} from '../file_handler';

export class NodeMessageHandler implements MessageHandler {
  private connection: rpc.MessageConnection;

  constructor() {
    this.connection = rpc.createMessageConnection(
      new rpc.IPCMessageReader(process),
      new rpc.IPCMessageWriter(process)
    );
    this.connection.listen();

    const connectionManager = new ConnectionManager(
      new DesktopConnectionFactory(),
      []
    );

    this.log('Worker started');

    const reader = new FileHandler(this.connection);

    const heartBeat = setInterval(() => {
      this.log('Heartbeat');
    }, 60 * 1000);

    this.connection.onRequest('cancel', (message: MessageCancel) =>
      cancelQuery(message)
    );
    this.connection.onRequest('config', (message: MessageConfig) =>
      refreshConfig(this, connectionManager, message)
    );
    this.connection.onRequest('download', (message: MessageDownload) =>
      downloadQuery(this, connectionManager, message, reader)
    );
    this.connection.onRequest('exit', () => clearInterval(heartBeat));
    this.connection.onRequest('run', (message: MessageRun) =>
      runQuery(this, reader, connectionManager, false, message)
    );

    process.on('exit', () => {
      this.log('Worker exited');
    });

    process.on('SIGHUP', () => {
      clearInterval(heartBeat);
    });
  }

  send(message: WorkerMessage) {
    this.connection.sendRequest(message.type, message);
  }

  log(message: string) {
    const msg: WorkerLogMessage = {
      type: 'log',
      message,
    };
    this.send(msg);
  }
}

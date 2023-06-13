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

import {cancelQuery, runQuery} from './run_query';
import {
  GenericConnection,
  ListenerType,
  MessageCancel,
  WorkerMessageHandler,
  MessageMap,
  MessageRun,
  MessageRunMSQL,
  WorkerMessageMap,
} from '../common/worker_message_types';
import {ConnectionManager} from '../common/connection_manager';
import {cancelMSQLQuery, runMSQLQuery} from './run_msql_query';
import {RpcFileHandler} from './file_handler';
import {FileHandler} from '../common/types';

export class MessageHandler implements WorkerMessageHandler {
  public fileHandler: FileHandler;
  constructor(
    private connection: GenericConnection,
    connectionManager: ConnectionManager
  ) {
    this.fileHandler = new RpcFileHandler(this);

    this.onRequest('malloy/cancel', (message: MessageCancel) =>
      cancelQuery(message)
    );

    this.onRequest('malloy/cancelMSQL', (message: MessageCancel) =>
      cancelMSQLQuery(message)
    );

    this.onRequest('malloy/run', (message: MessageRun) =>
      runQuery(this, this.fileHandler, connectionManager, false, message)
    );

    this.onRequest('malloy/run-msql', (message: MessageRunMSQL) =>
      runMSQLQuery(this, this.fileHandler, connectionManager, message)
    );
  }

  onRequest<K extends keyof MessageMap>(
    type: K,
    message: ListenerType<MessageMap[K]>
  ) {
    return this.connection.onRequest(type, message);
  }

  sendRequest<R, K extends keyof WorkerMessageMap>(
    type: K,
    message: WorkerMessageMap[K]
  ): Promise<R> {
    return this.connection.sendRequest(type, message);
  }

  log(message: string) {
    this.sendRequest('malloy/log', {message});
  }
}

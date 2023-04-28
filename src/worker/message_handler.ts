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

import * as rpc from 'vscode-jsonrpc';
import {cancelQuery, runQuery} from './run_query';
import {
  MessageCancel,
  MessageConfig,
  // MessageDownload,
  MessageRun,
  MessageRunMalloySQL,
  WorkerLogMessage,
  WorkerMessage,
} from '../common/worker_message_types';
import {FileHandler} from '../common/types';
import {refreshConfig} from './refresh_config';
import {ConnectionManager} from '../common/connection_manager';
import {runMalloySQLQuery} from './run_malloy_sql_query';

export class MessageHandler {
  heartBeat: ReturnType<typeof setInterval>;

  constructor(
    private connection: rpc.MessageConnection,
    connectionManager: ConnectionManager,
    fileHandler: FileHandler
  ) {
    this.heartBeat = setInterval(() => {
      this.log('Heartbeat');
    }, 60 * 1000);

    this.connection.onRequest('malloy/cancel', (message: MessageCancel) =>
      cancelQuery(message)
    );
    this.connection.onRequest('malloy/config', (message: MessageConfig) =>
      refreshConfig(this, connectionManager, message)
    );
    this.connection.onRequest('malloy/exit', () =>
      clearInterval(this.heartBeat)
    );
    this.connection.onRequest('malloy/run', (message: MessageRun) =>
      runQuery(this, fileHandler, connectionManager, false, message)
    );
    this.connection.onRequest(
      'malloy/run-malloy-sql',
      (message: MessageRunMalloySQL) =>
        runMalloySQLQuery(this, connectionManager, message)
    );
  }

  send(message: WorkerMessage) {
    this.connection.sendRequest(message.type, message);
  }

  log(message: string) {
    const msg: WorkerLogMessage = {
      type: 'malloy/log',
      message,
    };
    this.send(msg);
  }

  dispose() {
    clearInterval(this.heartBeat);
  }
}

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

/* eslint-disable no-console */
import * as vscode from 'vscode';
import * as rpc from 'vscode-jsonrpc/browser';
import {fetchBinaryFile, fetchCellData, fetchFile} from '../utils';
import {
  Message,
  WorkerLogMessage,
  WorkerMessage,
  WorkerReadBinaryMessage,
  WorkerReadCellDataMessage,
  WorkerReadMessage,
} from '../../common/worker_message_types';
const workerLog = vscode.window.createOutputChannel('Malloy Worker');

// const DEFAULT_RESTART_SECONDS = 1;

export type ListenerType = (message: WorkerMessage) => void;

export class WorkerConnection {
  worker: Worker;
  connection: rpc.MessageConnection;

  constructor(context: vscode.ExtensionContext) {
    const workerModule = vscode.Uri.joinPath(
      context.extensionUri,
      'dist/worker_browser.js'
    );

    const startWorker = () => {
      this.worker = new Worker(workerModule.toString());

      // TODO - Detect if worker is not responding and
      // restart

      this.connection = rpc.createMessageConnection(
        new rpc.BrowserMessageReader(this.worker),
        new rpc.BrowserMessageWriter(this.worker)
      );
      this.connection.listen();
      context.subscriptions.push(this.connection);

      context.subscriptions.push(
        this.connection.onRequest('log', (message: WorkerLogMessage) => {
          workerLog.appendLine(`worker: ${message.message}`);
        })
      );

      context.subscriptions.push(
        this.connection.onRequest(
          'read',
          async (message: WorkerReadMessage) => {
            workerLog.appendLine(`worker: reading file ${message.uri}`);
            return await fetchFile(message.uri);
          }
        )
      );

      context.subscriptions.push(
        this.connection.onRequest(
          'read_binary',
          async (message: WorkerReadBinaryMessage) => {
            workerLog.appendLine(`worker: reading binary file ${message.uri}`);
            return await fetchBinaryFile(message.uri);
          }
        )
      );

      context.subscriptions.push(
        this.connection.onRequest(
          'read_cell_data',
          async (message: WorkerReadCellDataMessage) => {
            workerLog.appendLine(
              `worker: reading cell data for ${message.uri}`
            );
            return await fetchCellData(message.uri);
          }
        )
      );

      context.subscriptions.push({
        dispose: () => {
          this.worker.terminate();
        },
      });
    };

    startWorker();
  }

  send(message: Message): void {
    this.connection.sendRequest(message.type, message);
  }

  notifyListeners(_message: WorkerMessage): void {
    // this.connection.sendNotification(message.type, message);
  }

  on(
    event: string,
    listener: (message: WorkerMessage) => void
  ): vscode.Disposable {
    return this.connection.onRequest(event, listener);
  }

  stop(): void {
    this.worker.terminate();
  }
}

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

import * as vscode from 'vscode';
import * as rpc from 'vscode-jsonrpc/node';
import {
  Message,
  WorkerLogMessage,
  WorkerMessage,
  WorkerReadBinaryMessage,
  WorkerReadCellDataMessage,
  WorkerReadMessage,
} from '../common/worker_message_types';
import {FileHandler} from '../common/types';
const workerLog = vscode.window.createOutputChannel('Malloy Worker');

export type ListenerType = (message: WorkerMessage) => void;

export abstract class WorkerConnectionBase {
  connection: rpc.MessageConnection;
  listeners: ListenerType[] = [];

  constructor(
    private context: vscode.ExtensionContext,
    private fileHandler: FileHandler
  ) {}

  subscribe() {
    this.context.subscriptions.push(
      this._on('malloy/log', (message: WorkerLogMessage) => {
        workerLog.appendLine(message.message);
      })
    );

    this.context.subscriptions.push(
      this._on('malloy/read', async (message: WorkerReadMessage) => {
        workerLog.appendLine(`reading file ${message.uri}`);
        return await this.fileHandler.fetchFile(message.uri);
      })
    );

    this.context.subscriptions.push(
      this._on(
        'malloy/readBinary',
        async (message: WorkerReadBinaryMessage) => {
          workerLog.appendLine(`reading binary file ${message.uri}`);
          return await this.fileHandler.fetchBinaryFile(message.uri);
        }
      )
    );

    this.context.subscriptions.push(
      this._on(
        'malloy/readCellData',
        async (message: WorkerReadCellDataMessage) => {
          workerLog.appendLine(`reading cell data for ${message.uri}`);
          return await this.fileHandler.fetchCellData(message.uri);
        }
      )
    );

    this.context.subscriptions.push(this);
  }

  send(message: Message): void {
    this.connection.sendRequest(message.type, message);
  }

  notifyListeners(message: WorkerMessage): void {
    this.listeners.forEach(listener => listener(message));
  }

  private _on(
    event: WorkerMessage['type'],
    listener: ListenerType
  ): vscode.Disposable {
    return this.connection.onRequest(event, listener);
  }

  on(event: WorkerMessage['type'], listener: ListenerType): vscode.Disposable {
    this.listeners.push(listener);
    const disposable = this._on(event, listener);
    return {
      dispose: () => {
        disposable.dispose();
        this.listeners = this.listeners.filter(l => l !== listener);
      },
    };
  }

  abstract dispose(): void;
}

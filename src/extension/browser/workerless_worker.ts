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
import {ClientFileHandler} from '../utils';
import {
  BaseWorker,
  Message,
  WorkerMessage,
} from '../../common/worker_message_types';
import {connectionManager} from './connection_manager';
// Required because this is a stub for the worker because of
// https://github.com/malloydata/malloy-vscode-extension/issues/58
// eslint-disable-next-line no-restricted-imports
import {cancelQuery, runQuery} from '../../worker/run_query';
import {Disposable} from 'vscode-jsonrpc';

const workerLog = vscode.window.createOutputChannel('Malloy Worker');

export type ListenerType = (message: WorkerMessage) => void;

const fileHandler = new ClientFileHandler();

export class WorkerConnection implements BaseWorker {
  listeners: Record<string, ListenerType[]> = {};
  constructor(_context: vscode.ExtensionContext) {
    workerLog.appendLine('Worker started');
  }

  send(message: Message): void {
    switch (message.type) {
      case 'malloy/config':
        // Shared with extension
        // refreshConfig(connectionManager, message);
        break;
      case 'malloy/cancel':
        cancelQuery(message);
        break;
      case 'malloy/run':
        runQuery(
          {
            send: (message: WorkerMessage) => this._send(message),
            log(message: string) {
              workerLog.appendLine(message);
            },
          },
          fileHandler,
          connectionManager,
          true,
          false,
          message
        );
        break;
      case 'malloy/show-sql':
        runQuery(
          {
            send: (message: WorkerMessage) => this._send(message),
            log(message: string) {
              workerLog.appendLine(message);
            },
          },
          fileHandler,
          connectionManager,
          true,
          true,
          message
        );
        break;
    }
  }

  _send(message: WorkerMessage): void {
    this.listeners[message.type] ??= [];
    this.listeners[message.type].forEach(listener => listener(message));
  }

  on(event: string, listener: ListenerType): Disposable {
    this.listeners[event] ??= [];
    this.listeners[event].push(listener);
    return {dispose: () => {}};
  }

  off(event: string, listener: ListenerType): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(l => l !== listener);
    }
  }

  stop(): void {
    // noop
  }
}

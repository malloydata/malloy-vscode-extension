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
import * as child_process from 'child_process';
import * as vscode from 'vscode';
import * as rpc from 'vscode-jsonrpc/node';
import {
  Message,
  WorkerLogMessage,
  WorkerMessage,
  WorkerReadBinaryMessage,
  WorkerReadCellDataMessage,
  WorkerReadMessage,
} from '../../common/worker_message_types';
import {FileHandler} from '../../common/types';

const DEFAULT_RESTART_SECONDS = 1;

export type ListenerType = (message: WorkerMessage) => void;

const workerLog = vscode.window.createOutputChannel('Malloy Worker');

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
      this._on('malloy/fetch', async (message: WorkerReadMessage) => {
        workerLog.appendLine(`reading file ${message.uri}`);
        return await this.fileHandler.fetchFile(message.uri);
      })
    );

    this.context.subscriptions.push(
      this._on(
        'malloy/fetchBinary',
        async (message: WorkerReadBinaryMessage) => {
          workerLog.appendLine(`reading binary file ${message.uri}`);
          return await this.fileHandler.fetchBinaryFile(message.uri);
        }
      )
    );

    this.context.subscriptions.push(
      this._on(
        'malloy/fetchCellData',
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

export class WorkerConnection extends WorkerConnectionBase {
  worker!: child_process.ChildProcess;

  constructor(context: vscode.ExtensionContext, fileHandler: FileHandler) {
    super(context, fileHandler);

    const workerModule = context.asAbsolutePath('dist/worker_node.js');
    const execArgv = ['--no-lazy'];
    if (context.extensionMode === vscode.ExtensionMode.Development) {
      execArgv.push(
        '--inspect=6010',
        '--preserve-symlinks',
        '--enable-source-maps'
      );
    }

    const startWorker = () => {
      this.worker = child_process
        .fork(workerModule, {execArgv})
        .on('error', console.error)
        .on('exit', status => {
          if (status !== 0) {
            console.error(`Worker exited with ${status}`);
            console.info(`Restarting in ${DEFAULT_RESTART_SECONDS} seconds`);
            // Maybe exponential backoff? Not sure what our failure
            // modes are going to be
            setTimeout(startWorker, DEFAULT_RESTART_SECONDS * 1000);
            // this.notifyListeners({type: 'malloy/dead'});
          }
        });

      this.connection = rpc.createMessageConnection(
        new rpc.IPCMessageReader(this.worker),
        new rpc.IPCMessageWriter(this.worker)
      );
      this.connection.listen();
      context.subscriptions.push(this.connection);

      this.subscribe();
    };
    startWorker();
  }

  dispose(): void {
    this.worker.kill('SIGHUP');
  }
}

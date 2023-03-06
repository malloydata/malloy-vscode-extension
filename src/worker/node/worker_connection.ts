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
import {fetchFile} from '../../extension/utils';
import {Message, WorkerMessage, WorkerReadMessage} from '../types';
const workerLog = vscode.window.createOutputChannel('Malloy Worker');

const DEFAULT_RESTART_SECONDS = 1;

export class WorkerConnection {
  worker!: child_process.ChildProcess;

  constructor(context: vscode.ExtensionContext) {
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
            this.notifyListeners({type: 'dead'});
          }
        })
        .on('message', (message: WorkerMessage) => {
          switch (message.type) {
            case 'log':
              workerLog.appendLine(`worker: ${message.message}`);
              break;
            case 'read': {
              workerLog.appendLine(`worker: reading file ${message.uri}`);
              this.readFile(message);
              break;
            }
          }
        });
    };
    startWorker();
  }

  send(message: Message): void {
    this.worker.send?.(message);
  }

  notifyListeners(message: WorkerMessage): void {
    this.worker.emit('message', message);
  }

  on(event: string, listener: (message: WorkerMessage) => void): void {
    this.worker.on(event, listener);
  }

  off(event: string, listener: (message: WorkerMessage) => void): void {
    this.worker.off(event, listener);
  }

  stop(): void {
    this.worker.kill('SIGHUP');
  }

  async readFile(message: WorkerReadMessage): Promise<void> {
    const {id, uri} = message;
    try {
      const data = await fetchFile(uri);
      this.send?.({type: 'read', id, uri, data});
    } catch (error) {
      this.send?.({type: 'read', id, uri, error: error.message});
    }
  }
}

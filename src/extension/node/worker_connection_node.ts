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

import * as child_process from 'child_process';
import stream from 'stream';
import * as vscode from 'vscode';
import * as rpc from 'vscode-jsonrpc/node';
import {FileHandler} from '../../common/types';
import {WorkerConnection} from '../worker_connection';
import {GenericConnection} from '../../common/worker_message_types';

const DEFAULT_RESTART_SECONDS = 1;

export class WorkerConnectionNode extends WorkerConnection {
  worker: child_process.ChildProcess | undefined;
  _connection: GenericConnection | undefined;

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

    const cwd = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    const startWorker = () => {
      let connection: rpc.MessageConnection | null = null;

      const stdoutStream = new stream.Writable({
        write: data => {
          console.info(data.toString());
        },
      });
      const stderrStream = new stream.Writable({
        write: data => {
          console.error(data.toString());
        },
      });

      this.worker = child_process
        // .spawn('node', [workerModule, ...execArgv], {stdio: ['ipc'], cwd})
        .fork(workerModule, {
          execArgv,
          cwd,
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        })
        .on('error', console.error)
        .on('exit', status => {
          connection?.dispose();
          console.error(`Worker exited with ${status}`);
          if (status !== 0) {
            console.info(`Restarting in ${DEFAULT_RESTART_SECONDS} seconds`);
            // Maybe exponential backoff? Not sure what our failure
            // modes are going to be
            setTimeout(startWorker, DEFAULT_RESTART_SECONDS * 1000);
          }
        });

      this.worker.stdout?.pipe(stdoutStream);
      this.worker.stderr?.pipe(stderrStream);

      connection = rpc.createMessageConnection(
        new rpc.IPCMessageReader(this.worker),
        new rpc.IPCMessageWriter(this.worker)
      );
      connection.listen();
      context.subscriptions.push(connection);
      this._connection = connection;

      this.subscribe();
    };
    startWorker();
  }

  get connection() {
    if (!this._connection) {
      throw new Error('Uninitialized connection');
    }
    return this._connection;
  }

  dispose(): void {
    this.worker?.kill('SIGHUP');
  }
}

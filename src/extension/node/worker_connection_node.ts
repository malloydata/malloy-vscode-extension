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
import stream from 'stream';
import * as vscode from 'vscode';
import * as rpc from 'vscode-jsonrpc/node';
import {FileHandler} from '../../common/types';
import {WorkerConnection} from '../worker_connection';

const DEFAULT_RESTART_SECONDS = 1;

export class WorkerConnectionNode extends WorkerConnection {
  worker!: child_process.ChildProcess;

  constructor(context: vscode.ExtensionContext, fileHandler: FileHandler) {
    super(context, fileHandler);

    const workerModule = context.asAbsolutePath('dist/worker_node.js');
    const execArgv = ['--no-lazy'];
    if (context.extensionMode === vscode.ExtensionMode.Development) {
      execArgv.push(
        '--inspect=6010',
        '--preserve-symlinks',
        '--enable-source-maps',
        '--max-old-space-size=40096'
      );
    }

    const cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;

    const startWorker = () => {
      let connection: rpc.MessageConnection | null = null;

      console.log('Creating worker');
      const stdoutStream = new stream.Writable({
        write: data => {
          console.log(`Message from worker: ${data.toString()}`);
        },
      });
      const stderrStream = new stream.Writable({
        write: data => {
          console.error(`Error Message from worker: ${data.toString()}`);
        },
      });

      const spwn = child_process.spawn(
        '/usr/local/google/home/figutierrez/Dev/malloy/duckdb',
        {detached: true }
      );
      

      this.worker = child_process
        // .spawn('node', [workerModule, ...execArgv], {stdio: ['ipc'], cwd})
        .exec(workerModule, {
          execArgv,
          cwd,
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
          detached: true,
        })
        .on('error', error => console.error(`An Error: ${error}`))
        .on('message', message =>
          console.log(
            `Received message from worker: ${JSON.stringify(message)}`
          )
        )
        .on('disconnect', () => console.log('disconnected!'))
        .on('close', (code, signal) =>
          console.log(`-----> closed ${code} ${signal}`)
        )
        .on('exit', (status, signal) => {
          connection.dispose();
          console.error(
            `Worker exited with ${status} ${JSON.stringify(signal)}`
          );
          if (status !== 0) {
            console.info(`Restarting in ${DEFAULT_RESTART_SECONDS} seconds`);
            // Maybe exponential backoff? Not sure what our failure
            // modes are going to be
            setTimeout(startWorker, DEFAULT_RESTART_SECONDS * 1000);
          }
        });

      this.worker.stdout.pipe(stdoutStream);
      this.worker.stderr.pipe(stderrStream);

      connection = rpc.createMessageConnection(
        new rpc.IPCMessageReader(this.worker),
        new rpc.IPCMessageWriter(this.worker)
      );
      connection.listen();
      context.subscriptions.push(connection);
      this.connection = connection;

      this.subscribe();
    };
    startWorker();
  }

  dispose(): void {
    this.worker.kill('SIGHUP');
  }
}

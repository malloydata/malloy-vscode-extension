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

import {BaseWorker, WorkerMessage} from '../../common/worker_message_types';
import {malloyLog} from '../logger';
import {createOrReuseWebviewPanel, loadWebview} from './vscode_utils';
import {Utils} from 'vscode-uri';
import {
  SQLQueryMessageType,
  SQLQueryRunStatus,
} from '../../common/message_types';
import {MALLOY_EXTENSION_STATE, RunState} from '../state';

export function runMalloySQLQuery(
  worker: BaseWorker,
  panelId: string,
  name: string,
  query: string,
  connectionName: string,
  source = null,
  showSQLOnly = false
): void {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Malloy SQL Query (${name})`,
      cancellable: true,
    },
    (progress, token) => {
      const cancel = () => {
        worker.send({
          type: 'malloy/cancel',
          panelId,
        });
        if (current) {
          const actuallyCurrent = MALLOY_EXTENSION_STATE.getRunState(
            current.panelId
          );
          if (actuallyCurrent === current) {
            current.panel.dispose();
            MALLOY_EXTENSION_STATE.setRunState(current.panelId, undefined);
            token.isCancellationRequested = true;
          }
        }
      };

      token.onCancellationRequested(cancel);

      const current: RunState = createOrReuseWebviewPanel(
        'malloySQLQuery',
        name,
        panelId,
        cancel,
        query
      );

      const queryPageOnDiskPath = Utils.joinPath(
        MALLOY_EXTENSION_STATE.getExtensionUri(),
        'dist',
        'sql_query_page.js'
      );
      loadWebview(current, queryPageOnDiskPath);

      worker.send({
        type: 'malloy/run-malloy-sql',
        panelId,
        query,
        connectionName,
        source,
      });

      const runBegin = Date.now();

      return new Promise(resolve => {
        let off: vscode.Disposable | null = null;
        const listener = (msg: WorkerMessage) => {
          if (msg.type === 'malloy/dead') {
            current.messages.postMessage({
              type: SQLQueryMessageType.QueryStatus,
              status: SQLQueryRunStatus.Error,
              error: `The worker process has died, and has been restarted.
This is possibly the result of a database bug. \
Please consider filing an issue with as much detail as possible at \
https://github.com/malloydata/malloy/issues.`,
            });
            off?.dispose();
            resolve(undefined);
            return;
          } else if (msg.type !== 'malloy/SQLQueryPanel') {
            return;
          }
          const {message, panelId: msgPanelId} = msg;

          if (msgPanelId !== panelId) return;

          current.messages.postMessage({
            ...message,
          });

          if (message.type === SQLQueryMessageType.QueryStatus) {
            switch (message.status) {
              case SQLQueryRunStatus.Compiling:
                {
                  progress.report({increment: 20, message: 'Compiling'});
                }
                break;
              case SQLQueryRunStatus.Compiled:
                break;
              case SQLQueryRunStatus.Running:
                {
                  malloyLog.appendLine(message.sql);

                  progress.report({increment: 40, message: 'Running'});
                }
                break;
              case SQLQueryRunStatus.Done:
                {
                  logTime('Run', runBegin, Date.now());
                  progress.report({increment: 100, message: 'Rendering'});

                  off?.dispose();
                  resolve(undefined);
                }
                break;
              case SQLQueryRunStatus.Error:
                {
                  off?.dispose();
                  resolve(undefined);
                }
                break;
            }
          }
        };

        off = worker.on('malloy/SQLQueryPanel', listener);
      });
    }
  );
}

function logTime(name: string, start: number, end: number) {
  malloyLog.appendLine(
    `${name} time: ${((end - start) / 1000).toLocaleString()}s`
  );
}

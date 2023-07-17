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

import {malloyLog} from '../logger';
import {
  createOrReuseWebviewPanel,
  loadWebview,
  showSchemaTreeViewWhenFocused,
} from './vscode_utils';
import {Utils} from 'vscode-uri';
import {
  MSQLMessageStatus,
  MSQLQueryRunStatus,
  QueryRunStatus,
  msqlPanelProgress,
} from '../../common/message_types';
import {MALLOY_EXTENSION_STATE, RunState} from '../state';
import {Disposable /* , State */} from 'vscode-languageclient';
import {WorkerConnection} from '../worker_connection';

export function runMSQLQuery(
  worker: WorkerConnection,
  panelId: string,
  name: string,
  document: vscode.TextDocument,
  statementIndex: number | null,
  showSQLOnly = false
): void {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `MalloySQL Query (${name})`,
      cancellable: true,
    },
    (progress, token) => {
      const cancel = () => {
        worker.sendRequest('malloy/cancelMSQL', {
          panelId: panelId,
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
        document
      );

      const queryPageOnDiskPath = Utils.joinPath(
        MALLOY_EXTENSION_STATE.getExtensionUri(),
        'dist',
        'msql_query_page.js'
      );
      loadWebview(current, queryPageOnDiskPath);
      showSchemaTreeViewWhenFocused(current.panel, panelId);

      const malloySQLQuery = document.getText();

      const runBegin = Date.now();

      return new Promise(resolve => {
        worker
          .sendRequest('malloy/run-msql', {
            panelId,
            malloySQLQuery,
            statementIndex,
            showSQLOnly,
          })
          .catch(() => {
            current.messages.postMessage({
              status: QueryRunStatus.Error,
              error: `The worker process has died, and has been restarted.
This is possibly the result of a database bug. \
Please consider filing an issue with as much detail as possible at \
https://github.com/malloydata/malloy-vscode-extension/issues.`,
            });
          })
          .finally(() => {
            unsubscribe();
            resolve(undefined);
          });

        const subscriptions: Disposable[] = [];
        const unsubscribe = () =>
          subscriptions.forEach(subscription => subscription.dispose());
        const listener = (message: MSQLMessageStatus) => {
          current.messages.postMessage({
            ...message,
          });

          switch (message.status) {
            case MSQLQueryRunStatus.Compiling:
              {
                progress.report({
                  increment: 100 / message.totalStatements / 4,
                  message: `Compiling Statement ${message.statementIndex + 1}`,
                });
              }
              break;
            case MSQLQueryRunStatus.Running:
              {
                progress.report({
                  increment: ((100 / message.totalStatements) * 3) / 4,
                  message: `Running Statement ${message.statementIndex + 1}`,
                });
              }
              break;
            case MSQLQueryRunStatus.Done:
              {
                logTime('Run', runBegin, Date.now());
                progress.report({increment: 100, message: 'Rendering'});
              }
              break;
            case MSQLQueryRunStatus.Error:
              {
                progress.report({increment: 100, message: 'Error'});
              }
              break;
          }
        };

        subscriptions.push(
          worker.onProgress(msqlPanelProgress, panelId, listener)
        );
      });
    }
  );
}

function logTime(name: string, start: number, end: number) {
  malloyLog.appendLine(
    `${name} time: ${((end - start) / 1000).toLocaleString()}s`
  );
}

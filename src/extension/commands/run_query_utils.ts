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
import {Utils} from 'vscode-uri';

import {MALLOY_EXTENSION_STATE, RunState} from '../state';
import {Result, ResultJSON} from '@malloydata/malloy';
import {
  QueryMessageStatus,
  QueryMessageType,
  QueryRunStatus,
  queryPanelProgress,
} from '../../common/message_types';
import {queryDownload} from './query_download';
import {malloyLog} from '../logger';
import {trackQueryRun} from '../telemetry';
import {QuerySpec} from './query_spec';
import {Disposable} from 'vscode-jsonrpc';
import {
  createOrReuseWebviewPanel,
  loadWebview,
  showSchemaTreeViewWhenFocused,
} from './vscode_utils';
import {WorkerConnection} from '../worker_connection';
import {WorkerQueryPanelMessage} from '../../common/worker_message_types';

export function runMalloyQuery(
  worker: WorkerConnection,
  query: QuerySpec,
  panelId: string,
  name: string,
  showSQLOnly = false
): Thenable<ResultJSON | undefined> {
  return vscode.window.withProgress<ResultJSON | undefined>(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Malloy Query (${name})`,
      cancellable: true,
    },
    (progress, token) => {
      const cancel = () => {
        worker.sendRequest('malloy/cancel', {
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
        'malloyQuery',
        name,
        panelId,
        cancel,
        query.file
      );

      const queryPageOnDiskPath = Utils.joinPath(
        MALLOY_EXTENSION_STATE.getExtensionUri(),
        'dist',
        'query_page.js'
      );
      loadWebview(current, queryPageOnDiskPath);
      showSchemaTreeViewWhenFocused(current.panel, panelId);

      const {file, ...params} = query;
      const uri = file.uri.toString();

      return new Promise(resolve => {
        worker
          .sendRequest('malloy/run', {
            query: {
              uri,
              ...params,
            },
            panelId,
            name,
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

        const listener = (message: QueryMessageStatus) => {
          current.messages.postMessage({
            ...message,
          });

          switch (message.status) {
            case QueryRunStatus.Compiling:
              {
                progress.report({increment: 20, message: 'Compiling'});
              }
              break;
            case QueryRunStatus.Compiled:
              {
                malloyLog.appendLine(message.sql);

                if (showSQLOnly) {
                  progress.report({increment: 100, message: 'Complete'});
                  resolve(undefined);
                }
              }
              break;
            case QueryRunStatus.EstimatedCost:
              {
                unsubscribe();
              }
              break;
            case QueryRunStatus.Running:
              {
                trackQueryRun({dialect: message.dialect});

                progress.report({increment: 40, message: 'Running'});
              }
              break;
            case QueryRunStatus.Done:
              {
                if (message.stats !== undefined) {
                  logTime('Compile', message.stats.compileTime);
                  logTime('Run', message.stats.runTime);
                  logTime('Total', message.stats.totalTime);
                }
                const {resultJson} = message;
                const queryResult = Result.fromJSON(resultJson);
                progress.report({increment: 100, message: 'Rendering'});

                current.messages.onReceiveMessage(message => {
                  if (message.status === QueryRunStatus.StartDownload) {
                    queryDownload(
                      worker,
                      query,
                      message.downloadOptions,
                      queryResult,
                      panelId,
                      name
                    );
                  }
                });

                unsubscribe();
                resolve(message.resultJson);
              }
              break;
            case QueryRunStatus.Error:
              {
                unsubscribe();
                resolve(undefined);
              }
              break;
          }
        };

        subscriptions.push(
          worker.onProgress(queryPanelProgress, panelId, listener)
        );
      });
    }
  );
}

function logTime(name: string, time: number) {
  malloyLog.appendLine(`${name} time: ${time}s`);
}

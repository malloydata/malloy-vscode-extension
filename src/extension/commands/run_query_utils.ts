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
import {Result} from '@malloydata/malloy';
import {QueryMessageType, QueryRunStatus} from '../../common/message_types';
import {queryDownload} from './query_download';
import {BaseWorker, WorkerMessage} from '../../common/worker_message_types';
import {malloyLog} from '../logger';
import {trackQueryRun} from '../telemetry';
import {QuerySpec} from './query_spec';
import {Disposable} from 'vscode-jsonrpc';
import {createOrReuseWebviewPanel, loadWebview} from './vscode_utils';

export function runMalloyQuery(
  worker: BaseWorker,
  query: QuerySpec,
  panelId: string,
  name: string,
  showSQLOnly = false
): void {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Malloy Query (${name})`,
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

      const {file, ...params} = query;
      const uri = file.uri.toString();
      worker.send({
        type: 'malloy/run',
        query: {
          uri,
          ...params,
        },
        panelId,
        name,
        showSQLOnly,
      });
      const allBegin = Date.now();
      const compileBegin = allBegin;
      let runBegin: number;

      return new Promise(resolve => {
        let off: Disposable | null = null;
        const listener = (msg: WorkerMessage) => {
          if (msg.type === 'malloy/dead') {
            current.messages.postMessage({
              type: QueryMessageType.QueryStatus,
              status: QueryRunStatus.Error,
              error: `The worker process has died, and has been restarted.
This is possibly the result of a database bug. \
Please consider filing an issue with as much detail as possible at \
https://github.com/malloydata/malloy/issues.`,
            });
            off?.dispose();
            resolve(undefined);
            return;
          } else if (msg.type !== 'malloy/queryPanel') {
            return;
          }
          const {message, panelId: msgPanelId} = msg;
          if (msgPanelId !== panelId) {
            return;
          }
          current.messages.postMessage({
            ...message,
          });

          switch (message.type) {
            case QueryMessageType.QueryStatus:
              switch (message.status) {
                case QueryRunStatus.Compiling:
                  {
                    progress.report({increment: 20, message: 'Compiling'});
                  }
                  break;
                case QueryRunStatus.Compiled:
                  {
                    const compileEnd = Date.now();
                    runBegin = compileEnd;
                    malloyLog.appendLine(message.sql);
                    logTime('Compile', compileBegin, compileEnd);

                    if (showSQLOnly) {
                      progress.report({increment: 100, message: 'Complete'});
                      off?.dispose();
                      resolve(undefined);
                    }
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
                    const runEnd = Date.now();
                    if (runBegin !== null) {
                      logTime('Run', runBegin, runEnd);
                    }
                    const {resultJson} = message;
                    const queryResult = Result.fromJSON(resultJson);
                    progress.report({increment: 100, message: 'Rendering'});
                    const allEnd = Date.now();
                    logTime('Total', allBegin, allEnd);

                    current.messages.onReceiveMessage(message => {
                      if (message.type === QueryMessageType.StartDownload) {
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

                    off?.dispose();
                    resolve(undefined);
                  }
                  break;
                case QueryRunStatus.Error:
                  {
                    off?.dispose();
                    resolve(undefined);
                  }
                  break;
              }
          }
        };

        off = worker.on('malloy/queryPanel', listener);
      });
    }
  );
}

function logTime(name: string, start: number, end: number) {
  malloyLog.appendLine(
    `${name} time: ${((end - start) / 1000).toLocaleString()}s`
  );
}

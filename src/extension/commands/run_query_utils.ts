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
  QueryRunStatus,
  queryPanelProgress,
} from '../../common/message_types';
import {queryDownload} from './query_download';
import {malloyLog} from '../logger';
import {trackQueryRun} from '../telemetry';
import {QuerySpec} from './query_spec';
import {CancellationTokenSource, Disposable} from 'vscode-jsonrpc';
import {
  createOrReuseWebviewPanel,
  disposeWebviewPanel,
  loadWebview,
  showSchemaTreeViewWhenFocused,
} from './vscode_utils';
import {WorkerConnection} from '../worker_connection';

export interface RunMalloyQueryOptions {
  showSQLOnly?: boolean;
  withWebview?: boolean;
  defaultTab?: string;
}

export function runMalloyQuery(
  worker: WorkerConnection,
  query: QuerySpec,
  panelId: string,
  name: string,
  options: RunMalloyQueryOptions = {},
  cancellationToken: vscode.CancellationToken,
  progress?: vscode.Progress<{message?: string; increment?: number}>
): Thenable<ResultJSON | undefined> {
  const showSQLOnly = options.showSQLOnly ?? false;
  const withWebview = options.withWebview ?? true;
  const {defaultTab} = options;

  return new Promise((resolve, reject) => {
    const cancellationTokenSource = new CancellationTokenSource();
    const subscriptions: Disposable[] = [cancellationTokenSource];
    const unsubscribe = () => {
      let subscription;
      while ((subscription = subscriptions.pop())) {
        subscription.dispose();
      }
    };

    const cancel = () => {
      unsubscribe();
      cancellationTokenSource.cancel();
      resolve(undefined);
    };

    const onCancel = () => {
      cancel();
      if (current) {
        disposeWebviewPanel(current);
      }
    };

    cancellationToken.onCancellationRequested(onCancel);

    let current: RunState | null = null;

    if (withWebview) {
      current = createOrReuseWebviewPanel(
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
    }

    const {file, ...params} = query;
    const uri = file.uri.toString();

    worker
      .sendRequest(
        'malloy/run',
        {
          query: {
            uri,
            ...params,
          },
          panelId,
          name,
          showSQLOnly,
          defaultTab,
        },
        cancellationTokenSource.token
      )
      .catch(() => {
        const error = `The worker process has died, and has been restarted.
This is possibly the result of a database bug. \
Please consider filing an issue with as much detail as possible at \
https://github.com/malloydata/malloy-vscode-extension/issues.`;
        current?.messages.postMessage({
          status: QueryRunStatus.Error,
          error,
        });
        if (withWebview) {
          resolve(undefined);
        } else {
          reject(new Error(error));
        }
      })
      .finally(() => {
        unsubscribe();
      });

    const listener = (message: QueryMessageStatus) => {
      current?.messages.postMessage({
        ...message,
      });

      switch (message.status) {
        case QueryRunStatus.Compiling:
          {
            progress?.report({increment: 20, message: 'Compiling'});
          }
          break;
        case QueryRunStatus.Compiled:
          {
            malloyLog.appendLine(message.sql);

            if (showSQLOnly) {
              progress?.report({increment: 100, message: 'Complete'});
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

            progress?.report({increment: 40, message: 'Running'});
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
            progress?.report({increment: 100, message: 'Rendering'});

            current?.messages.onReceiveMessage(message => {
              if (message.status === QueryRunStatus.StartDownload) {
                queryDownload(
                  worker,
                  query,
                  message.downloadOptions,
                  queryResult,
                  panelId,
                  name
                );
              } else if (message.status === QueryRunStatus.RunCommand) {
                vscode.commands.executeCommand(
                  message.command,
                  ...message.args
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
            if (withWebview) {
              resolve(undefined);
            } else {
              reject(new Error(message.error));
            }
          }
          break;
      }
    };

    subscriptions.push(
      worker.onProgress(queryPanelProgress, panelId, listener)
    );
  });
}

function logTime(name: string, time: number) {
  malloyLog.appendLine(`${name} time: ${time}s`);
}

export function runMalloyQueryWithProgress(
  worker: WorkerConnection,
  query: QuerySpec,
  panelId: string,
  name: string,
  options: RunMalloyQueryOptions = {}
): Thenable<ResultJSON | undefined> {
  return vscode.window.withProgress<ResultJSON | undefined>(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Malloy Query (${name})`,
      cancellable: true,
    },
    (progress, cancellationToken) => {
      return runMalloyQuery(
        worker,
        query,
        panelId,
        name,
        options,
        cancellationToken,
        progress
      );
    }
  );
}

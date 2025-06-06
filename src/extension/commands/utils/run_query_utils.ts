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

import {MALLOY_EXTENSION_STATE, RunState} from '../../state';
import {Result} from '@malloydata/malloy';
import {
  QueryMessageStatus,
  QueryRunStatus,
  RunMalloyQueryResult,
  queryPanelProgress,
} from '../../../common/types/message_types';
import {queryDownload} from './query_download_utils';
import {malloyLog} from '../../logger';
import {trackQueryRun} from '../../telemetry';
import {DocumentMetadata, QuerySpec} from '../../../common/types/query_spec';
import {CancellationTokenSource, Disposable} from 'vscode-jsonrpc';
import {
  createOrReuseWebviewPanel,
  disposeWebviewPanel,
  showSchemaTreeViewWhenFocused,
} from './vscode_utils';
import {WorkerConnection} from '../../worker_connection';
import {noAwait} from '../../../util/no_await';

export interface RunMalloyQueryOptions {
  showSQLOnly?: boolean;
  showSchemaOnly?: boolean;
  withWebview?: boolean;
  defaultTab?: string;
}

/**
 * Return the DocumentMetadata for the given TextDocument
 *
 * @param document
 */
export function getDocumentMetadata(
  document: vscode.TextDocument
): DocumentMetadata;
/**
 * Return the metadata for the given TextDocument, or
 * `undefined` if the TextDocument is `undefined`
 *
 * @param document
 */
export function getDocumentMetadata(
  document: vscode.TextDocument | undefined
): DocumentMetadata | undefined;
export function getDocumentMetadata(
  document: vscode.TextDocument | undefined
): DocumentMetadata | undefined {
  if (!document) {
    return undefined;
  }

  const {fileName, languageId, uri, version} = document;

  return {
    fileName,
    languageId,
    uri: uri.toString(),
    version,
  };
}

/**
 * Returns the metadata for the current active document, either from the
 * active editor or the last used document
 *
 * @returns metadata for current active document
 */
export function getActiveDocumentMetadata() {
  return (
    getDocumentMetadata(vscode.window.activeTextEditor?.document) ||
    MALLOY_EXTENSION_STATE.getActiveWebviewPanel()?.document
  );
}

export function getDocumentMetadataFromUri(uri: string) {
  const {path: fileName} = vscode.Uri.parse(uri);
  return {
    fileName,
    languageId: 'malloy',
    uri,
    version: 0,
  };
}

export async function runMalloyQuery(
  worker: WorkerConnection,
  query: QuerySpec,
  panelId: string,
  name: string,
  options: RunMalloyQueryOptions = {},
  cancellationToken: vscode.CancellationToken,
  progress?: vscode.Progress<{message?: string; increment?: number}>
): Promise<RunMalloyQueryResult | undefined> {
  const showSQLOnly = options.showSQLOnly ?? false;
  const showSchemaOnly = options.showSchemaOnly ?? false;
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
      cancellationTokenSource.cancel();
      unsubscribe();
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
        'query_page',
        name,
        panelId,
        cancel,
        query.documentMeta
      );
      subscriptions.push(showSchemaTreeViewWhenFocused(current.panel, panelId));
    }

    worker
      .sendRequest(
        'malloy/run',
        {
          query,
          panelId,
          name,
          showSQLOnly,
          showSchemaOnly,
          defaultTab,
        },
        cancellationTokenSource.token
      )
      .catch(e => {
        console.error(e);
        const error =
          'The worker process has died, and has been restarted. ' +
          'This is possibly the result of a database bug. ' +
          'Please consider filing an issue with as much detail as possible at ' +
          'https://github.com/malloydata/malloy-vscode-extension/issues. ' +
          'You many want to use an external NodeJS process to increase the ' +
          'amount of available memory by setting vscode://settings/malloy.nodePath';
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
        case QueryRunStatus.Schema:
          {
            progress?.report({increment: 100, message: 'Complete'});
            current?.messages.onReceiveMessage(message => {
              if (message.status === QueryRunStatus.RunCommand) {
                MALLOY_EXTENSION_STATE.setActiveWebviewPanelId(panelId);
                noAwait(
                  vscode.commands.executeCommand(
                    message.command,
                    ...message.args
                  )
                );
              }
            });
            unsubscribe();
            resolve(undefined);
          }
          break;
        case QueryRunStatus.EstimatedCost:
          {
            unsubscribe();
          }
          break;
        case QueryRunStatus.Running:
          {
            noAwait(trackQueryRun({dialect: message.dialect}));

            progress?.report({increment: 40, message: 'Running'});
          }
          break;
        case QueryRunStatus.Done:
          {
            const {profilingUrl, resultJson, stats} = message;
            if (stats !== undefined) {
              logTime('Compile', stats.compileTime);
              logTime('Run', stats.runTime);
              logTime('Total', stats.totalTime);
            }
            const queryResult = Result.fromJSON(resultJson);
            progress?.report({increment: 100, message: 'Rendering'});

            current?.messages.onReceiveMessage(message => {
              if (message.status === QueryRunStatus.StartDownload) {
                noAwait(
                  queryDownload(
                    worker,
                    query,
                    message.downloadOptions,
                    queryResult,
                    panelId,
                    name
                  )
                );
              } else if (message.status === QueryRunStatus.RunCommand) {
                MALLOY_EXTENSION_STATE.setActiveWebviewPanelId(panelId);
                noAwait(
                  vscode.commands.executeCommand(
                    message.command,
                    ...message.args
                  )
                );
              }
            });

            unsubscribe();
            resolve({profilingUrl, resultJson, stats});
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
): Thenable<RunMalloyQueryResult | undefined> {
  return vscode.window.withProgress<RunMalloyQueryResult | undefined>(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Running (${name})`,
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

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';

import {MALLOY_EXTENSION_STATE, RunState} from '../../state';
import {GivenValue, Result} from '@malloydata/malloy';
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
import {
  setRenderDiagnostics,
  clearRenderDiagnostics,
} from '../../render_diagnostics';
import {WorkerConnection} from '../../worker_connection';
import {noAwait} from '../../../util/no_await';

export interface RunMalloyQueryOptions {
  showSQLOnly?: boolean;
  showSchemaOnly?: boolean;
  withWebview?: boolean;
  defaultTab?: string;
  givens?: Record<string, GivenValue>;
}

/** Args needed to invoke `runMalloyQuery` again on the same panel. */
interface PanelRerunState {
  context: vscode.ExtensionContext;
  worker: WorkerConnection;
  query: QuerySpec;
  name: string;
  options: RunMalloyQueryOptions;
}

const panelRerunStates: Map<string, PanelRerunState> = new Map();

export function getPanelRerunState(
  panelId: string
): PanelRerunState | undefined {
  return panelRerunStates.get(panelId);
}

/**
 * Forward a `RunCommand` message from the webview to the VS Code command
 * bus. Several phase handlers attach this — give them one place to call.
 */
function dispatchRunCommand(panelId: string, message: QueryMessageStatus) {
  if (message.status !== QueryRunStatus.RunCommand) return;
  MALLOY_EXTENSION_STATE.setActiveWebviewPanelId(panelId);
  noAwait(vscode.commands.executeCommand(message.command, ...message.args));
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
  context: vscode.ExtensionContext,
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
  const {defaultTab, givens} = options;
  const queryLine = MALLOY_EXTENSION_STATE.getActivePosition()?.line ?? 0;

  if (withWebview) {
    panelRerunStates.set(panelId, {context, worker, query, name, options});
  }

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
        context,
        'malloyQuery',
        'query_page',
        name,
        panelId,
        cancel,
        query.documentMeta
      );
      subscriptions.push(showSchemaTreeViewWhenFocused(current.panel, panelId));
      current.panel.onDidDispose(() => {
        panelRerunStates.delete(panelId);
      });
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
          givens,
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
            clearRenderDiagnostics(panelId);
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
            current?.messages.onReceiveMessage(message =>
              dispatchRunCommand(panelId, message)
            );
            unsubscribe();
            resolve(undefined);
          }
          break;
        case QueryRunStatus.Givens:
          // Attach now so the editor's Run button works even if the
          // run errors out before reaching Done.
          current?.messages.onReceiveMessage(message =>
            dispatchRunCommand(panelId, message)
          );
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
              dispatchRunCommand(panelId, message);
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
              } else if (message.status === QueryRunStatus.RenderLogs) {
                setRenderDiagnostics(
                  panelId,
                  message.logs,
                  query.documentMeta.uri,
                  queryLine
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
  context: vscode.ExtensionContext,
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
        context,
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

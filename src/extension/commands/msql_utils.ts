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

import {CommonLanguageClient} from 'vscode-languageclient';
import {malloyLog} from '../logger';
import {createOrReuseWebviewPanel, loadWebview} from './vscode_utils';
import {Utils} from 'vscode-uri';
import {MSQLMessageType, MSQLQueryRunStatus} from '../../common/message_types';
import {MALLOY_EXTENSION_STATE, RunState} from '../state';
import {WorkerMessage} from '../../common/worker_message_types';

export function runMSQLQuery(
  client: CommonLanguageClient,
  panelId: string,
  name: string,
  document: vscode.TextDocument,
  connectionName: string,
  statementIndex: number | null,
  importURL = null,
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
        client.sendRequest('malloy/cancel', {
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
        document
      );

      const queryPageOnDiskPath = Utils.joinPath(
        MALLOY_EXTENSION_STATE.getExtensionUri(),
        'dist',
        'msql_query_page.js'
      );
      loadWebview(current, queryPageOnDiskPath);

      const malloySQLQuery = document.getText();
      client.sendRequest('malloy/run-msql', {
        panelId,
        malloySQLQuery,
        connectionName,
        statementIndex,
        importURL,
        showSQLOnly,
      });

      const runBegin = Date.now();

      return new Promise(resolve => {
        let off: vscode.Disposable | null = null;
        const listener = (msg: WorkerMessage) => {
          if (msg.type !== 'malloy/MSQLQueryPanel') {
            return;
          }
          const {message, panelId: msgPanelId} = msg;

          if (msgPanelId !== panelId) return;

          current.messages.postMessage({
            ...message,
          });

          if (message.type === MSQLMessageType.QueryStatus) {
            switch (message.status) {
              case MSQLQueryRunStatus.Compiling:
                {
                  progress.report({
                    increment: 100 / message.totalStatements / 4,
                    message: `Compiling Statement ${
                      message.statementIndex + 1
                    }`,
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

                  off?.dispose();
                  resolve(undefined);
                }
                break;
              case MSQLQueryRunStatus.Error:
                {
                  off?.dispose();
                  resolve(undefined);
                }
                break;
            }
          }
        };

        off = client.onRequest('malloy/MSQLQueryPanel', listener);
      });
    }
  );
}

function logTime(name: string, start: number, end: number) {
  malloyLog.appendLine(
    `${name} time: ${((end - start) / 1000).toLocaleString()}s`
  );
}

export function getConnectionName(documentText: string): string {
  return (documentText.match(/--!( |\t)+connection:.*?(\n|$)/g) || [''])
    .shift()
    .split('connection:')[1]
    ?.trim();
}

export function getImportURL(documentText: string): string {
  return (documentText.match(/--!( |\t)+import:.*?(\n|$)/g) || [''])
    .shift()
    .split('import:')[1]
    ?.trim();
}

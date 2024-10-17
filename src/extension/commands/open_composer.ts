/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import * as vscode from 'vscode';
import {getWebviewHtml} from '../webviews';
import {
  ComposerMessage,
  ComposerMessageType,
  ComposerPageMessage,
  ComposerPageMessageType,
} from '../../common/types/message_types';
import {
  getActiveDocumentMetadata,
  runMalloyQuery,
} from './utils/run_query_utils';
import {Utils} from 'vscode-uri';
import {MALLOY_EXTENSION_STATE} from '../state';
import {WorkerConnection} from '../worker_connection';
import {WebviewMessageManager} from '../webview_message_manager';
import {QuerySpec} from '../../common/types/query_spec';

const icon = 'turtle.svg';

export async function openComposer(
  worker: WorkerConnection,
  sourceName?: string,
  viewName?: string
) {
  const documentMeta = getActiveDocumentMetadata();
  if (documentMeta) {
    const basename = Utils.basename(vscode.Uri.parse(documentMeta.uri));
    const composerPanel = vscode.window.createWebviewPanel(
      'malloyComposer',
      `Explore: ${basename} - ${sourceName || '*'}`,
      {viewColumn: vscode.ViewColumn.Beside, preserveFocus: true},
      {enableScripts: true, retainContextWhenHidden: true}
    );

    composerPanel.iconPath = Utils.joinPath(
      MALLOY_EXTENSION_STATE.getExtensionUri(),
      'img',
      icon
    );

    composerPanel.webview.html = getWebviewHtml(
      'composer_page',
      composerPanel.webview
    );

    const modelDef = await worker.sendRequest('malloy/compile', {
      documentMeta,
    });

    sourceName ??= Object.keys(modelDef.contents)[0];

    const messages = new WebviewMessageManager<
      ComposerMessage,
      ComposerPageMessage
    >(composerPanel);
    messages.postMessage({
      type: ComposerMessageType.NewModel,
      documentMeta,
      modelDef,
      sourceName,
      viewName,
    });
    messages.onReceiveMessage(message => {
      switch (message.type) {
        case ComposerPageMessageType.RunQuery:
          {
            const {id, query, queryName} = message;
            vscode.window
              .withProgress(
                {
                  location: vscode.ProgressLocation.Notification,
                  title: `Running ${queryName}`,
                  cancellable: true,
                },
                async (progress, cancellationToken) => {
                  const querySpec: QuerySpec = {
                    type: 'string',
                    text: query,
                    documentMeta,
                  };
                  const result = await runMalloyQuery(
                    worker,
                    querySpec,
                    id,
                    queryName,
                    {withWebview: false},
                    cancellationToken,
                    progress
                  );
                  return result;
                }
              )
              .then(
                result => {
                  if (result) {
                    messages.postMessage({
                      type: ComposerMessageType.ResultSuccess,
                      id,
                      result,
                    });
                  } else {
                    messages.postMessage({
                      type: ComposerMessageType.ResultError,
                      id,
                      error: 'No results',
                    });
                  }
                },
                error => {
                  messages.postMessage({
                    type: ComposerMessageType.ResultError,
                    id,
                    error: error instanceof Error ? error.message : `${error}`,
                  });
                }
              );
          }
          break;
      }
    });
  }
}

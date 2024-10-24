/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import * as vscode from 'vscode';
import {getWebviewHtml} from '../webviews';
import {getActiveDocumentMetadata} from './utils/run_query_utils';
import {Utils} from 'vscode-uri';
import {MALLOY_EXTENSION_STATE} from '../state';
import {WorkerConnection} from '../worker_connection';
import {ComposerMessageManager} from './utils/composer_message_manager';

const icon = 'turtle.svg';

export async function openComposer(
  worker: WorkerConnection,
  sourceName?: string,
  viewName?: string
) {
  const documentMeta = getActiveDocumentMetadata();
  if (documentMeta) {
    const basename = Utils.basename(vscode.Uri.parse(documentMeta.uri));
    const sourcePart = sourceName || '*';
    const viewPart = viewName ? ` -> ${viewName}` : '';
    const composerPanel = vscode.window.createWebviewPanel(
      'malloyComposer',
      `Explore: ${basename} - ${sourcePart}${viewPart}`,
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

    const messageManager = new ComposerMessageManager(
      worker,
      composerPanel,
      documentMeta,
      modelDef,
      sourceName,
      viewName
    );

    composerPanel.onDidDispose(() => {
      messageManager.dispose();
    });
  }
}

/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as vscode from 'vscode';
import {getWebviewHtml} from '../webviews';
import {getActiveDocumentMetadata} from './utils/run_query_utils';
import {Utils} from 'vscode-uri';
import {MALLOY_EXTENSION_STATE} from '../state';
import {WorkerConnection} from '../worker_connection';
import {ComposerMessageManager} from './utils/composer_message_manager';
import {errorMessage} from '../../common/errors';
import {getMalloyConfig} from '../utils/config';

const icon = 'turtle.svg';

const config = getMalloyConfig();
const newExplorer = config.get('useNewExplorer') as boolean;

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

    const messageManager = new ComposerMessageManager(
      worker,
      composerPanel,
      documentMeta,
      sourceName,
      viewName
    );

    if (newExplorer) {
      composerPanel.webview.html = getWebviewHtml(
        'explorer_page',
        composerPanel.webview
      );
    } else {
      composerPanel.webview.html = getWebviewHtml(
        'composer_page',
        composerPanel.webview
      );
    }
    try {
      void messageManager.newModel();
    } catch (error) {
      void vscode.window.showErrorMessage(errorMessage(error));
      composerPanel.dispose();
    }

    composerPanel.onDidDispose(() => {
      messageManager.dispose();
    });
  }
}

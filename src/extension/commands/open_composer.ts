/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as vscode from 'vscode';
import * as Malloy from '@malloydata/malloy-interfaces';
import {getWebviewHtml} from '../webviews';
import {getActiveDocumentMetadata} from './utils/run_query_utils';
import {Utils} from 'vscode-uri';
import {WorkerConnection} from '../worker_connection';
import {ComposerMessageManager} from './utils/composer_message_manager';
import {errorMessage} from '../../common/errors';
import {DocumentMetadata} from '../../common/types/query_spec';

const icon = 'turtle.svg';

export async function openComposer(
  context: vscode.ExtensionContext,
  worker: WorkerConnection,
  sourceName?: string,
  viewName?: string,
  initialQuery?: Malloy.Query,
  documentMeta?: DocumentMetadata
) {
  const fromDrill = !!documentMeta;
  documentMeta ??= getActiveDocumentMetadata();
  if (documentMeta) {
    const basename = Utils.basename(vscode.Uri.parse(documentMeta.uri));
    const sourcePart = sourceName || '*';
    const viewPart = viewName ? ` -> ${viewName}` : '';
    const composerPanel = vscode.window.createWebviewPanel(
      'malloyComposer',
      `Explore: ${basename} - ${sourcePart}${viewPart}`,
      {
        viewColumn: fromDrill
          ? vscode.ViewColumn.Active
          : vscode.ViewColumn.Beside,
        preserveFocus: true,
      },
      {enableScripts: true, retainContextWhenHidden: true}
    );

    composerPanel.iconPath = Utils.joinPath(context.extensionUri, 'img', icon);

    const messageManager = new ComposerMessageManager(
      context,
      worker,
      composerPanel,
      documentMeta,
      sourceName,
      viewName,
      initialQuery
    );

    composerPanel.webview.html = getWebviewHtml(
      context.extensionUri,
      'explorer_page',
      composerPanel.webview
    );

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

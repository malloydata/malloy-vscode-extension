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
import {spawn} from 'child_process';
import {Utils} from 'vscode-uri';
import {getWebviewHtml} from '../../webviews';
import {MALLOY_EXTENSION_STATE} from '../../state';
import {ComposerMessageType} from '../../../common/message_types';
import fetch from 'node-fetch';

const composerPanels: Record<string, vscode.WebviewPanel> = {};

export const openComposer = () => {
  const document = vscode.window.activeTextEditor?.document;
  if (!document) {
    vscode.window.showErrorMessage('No active document');
    return;
  }

  const composerPath = vscode.workspace
    .getConfiguration('malloy')
    .get('composerPath') as string;
  if (!composerPath) {
    vscode.window.showErrorMessage(
      'Please configure your Composer path in Settings'
    );
    return;
  }

  const uri = document.uri.toString();
  const documentPath = document.uri.fsPath;
  if (composerPanels[uri]) {
    composerPanels[uri].reveal(vscode.ViewColumn.Beside, true);
  } else {
    const composer = spawn(composerPath, ['--port=0', documentPath]).on(
      'error',
      error => {
        vscode.window.showErrorMessage(error.message);
      }
    );

    composer.stdout.on('data', (data: Buffer) => {
      const match = data.toString().match(/^Server is running.*:(\d+)\n$/);
      if (match) {
        const port = Number(match[1]);
        // eslint-disable-next-line no-console
        console.log(`Server on port ${port}`);

        const composerPanel = vscode.window.createWebviewPanel(
          'malloyComposer',
          'Preview: Malloy Composer',
          {viewColumn: vscode.ViewColumn.Beside, preserveFocus: true},
          {enableScripts: true, retainContextWhenHidden: true}
        );
        const onDiskPath = Utils.joinPath(
          MALLOY_EXTENSION_STATE.getExtensionUri(),
          'dist',
          'composer.js'
        );

        const entrySrc = composerPanel.webview.asWebviewUri(onDiskPath);

        composerPanel.webview.html = getWebviewHtml(
          entrySrc.toString(),
          composerPanel.webview
        );

        composerPanel.onDidDispose(() => {
          fetch(`http://localhost:${port}/shutdown`);
          composerPanels[uri] = null;
        });

        composerPanel.webview.postMessage({
          type: ComposerMessageType.ComposerReady,
          port,
        });

        composerPanels[uri] = composerPanel;
      } else {
        // eslint-disable-next-line no-console
        console.log(data.toString());
      }
    });
  }
};

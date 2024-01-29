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
import {RunState, MALLOY_EXTENSION_STATE} from '../../state';
import {WebviewMessageManager} from '../../webview_message_manager';
import {getWebviewHtml} from '../../webviews';
import {DocumentMetadata} from '../../../common/types/query_spec';

const turtleIcon = 'turtle.svg';

export function createOrReuseWebviewPanel(
  viewType: string,
  title: string,
  panelId: string,
  cancel: () => void,
  document: DocumentMetadata
): RunState {
  const previous = MALLOY_EXTENSION_STATE.getRunState(panelId);

  let current: RunState;
  if (previous) {
    current = {
      cancel,
      panelId,
      panel: previous.panel,
      messages: previous.messages,
      document: previous.document,
    };
    MALLOY_EXTENSION_STATE.setRunState(panelId, current);
    previous.cancel();
    if (!previous.panel.visible) {
      previous.panel.reveal(vscode.ViewColumn.Beside, true);
    }
  } else {
    const panel = vscode.window.createWebviewPanel(
      viewType,
      title,
      {viewColumn: vscode.ViewColumn.Beside, preserveFocus: true},
      {enableScripts: true, retainContextWhenHidden: true}
    );

    current = {
      panel,
      messages: new WebviewMessageManager(panel),
      panelId,
      cancel,
      document,
    };
    current.panel.iconPath = Utils.joinPath(
      MALLOY_EXTENSION_STATE.getExtensionUri(),
      'img',
      turtleIcon
    );
    MALLOY_EXTENSION_STATE.setRunState(panelId, current);
  }

  return current;
}

export function loadQueryWebview(current: RunState, module: string): void {
  current.panel.webview.html = getWebviewHtml(module, current.panel.webview);

  current.panel.onDidDispose(() => {
    current.cancel();
    const actuallyCurrent = MALLOY_EXTENSION_STATE.getRunState(current.panelId);
    if (actuallyCurrent === current) {
      MALLOY_EXTENSION_STATE.setRunState(current.panelId, undefined);
    }
  });

  MALLOY_EXTENSION_STATE.setActiveWebviewPanelId(current.panelId);
}

export function disposeWebviewPanel(current: RunState) {
  const actuallyCurrent = MALLOY_EXTENSION_STATE.getRunState(current.panelId);
  if (actuallyCurrent === current) {
    current.panel.dispose();
  }
}

export function showSchemaTreeViewWhenFocused(
  panel: vscode.WebviewPanel,
  panelId: string
): void {
  panel.onDidChangeViewState(event => {
    if (event.webviewPanel.active) {
      MALLOY_EXTENSION_STATE.setActiveWebviewPanelId(panelId);
      vscode.commands.executeCommand('malloy.refreshSchema');
    }
  });

  panel.onDidChangeViewState(
    (e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
      vscode.commands.executeCommand(
        'setContext',
        'malloy.webviewPanelFocused',
        e.webviewPanel.active
      );
    }
  );
}

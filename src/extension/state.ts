/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import {QueryMessageStatus} from '../common/types/message_types';
import {WebviewMessageManager} from './webview_message_manager';
import {Position} from 'vscode-languageclient';
import {DocumentMetadata} from '../common/types/query_spec';

export interface RunState {
  cancel: () => void;
  panel: vscode.WebviewPanel;
  messages: WebviewMessageManager<QueryMessageStatus>;
  panelId: string;
  document: DocumentMetadata;
}

class MalloyExtensionState {
  private activeWebviewPanelId: string | undefined;
  private runStates: Map<string, RunState> = new Map();
  private homeUri: vscode.Uri | undefined;
  private position: Position | undefined;

  setActiveWebviewPanelId(panelId: string) {
    this.activeWebviewPanelId = panelId;
  }

  getActiveWebviewPanelId() {
    return this.activeWebviewPanelId;
  }

  getActiveWebviewPanel() {
    const id = this.activeWebviewPanelId;
    return id ? this.getRunState(id) : undefined;
  }

  setActivePosition(position: Position) {
    this.position = position;
  }

  getActivePosition() {
    return this.position;
  }

  setRunState(panelId: string, state: RunState | undefined) {
    if (state) {
      this.runStates.set(panelId, state);
    } else {
      this.runStates.delete(panelId);
    }
  }

  getRunState(panelId: string) {
    return this.runStates.get(panelId);
  }

  setHomeUri(uri: vscode.Uri) {
    this.homeUri = uri;
  }

  getHomeUri(): vscode.Uri | undefined {
    return this.homeUri;
  }
}

export const MALLOY_EXTENSION_STATE = new MalloyExtensionState();

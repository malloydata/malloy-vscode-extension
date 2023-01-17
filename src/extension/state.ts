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

import { TextDocument, WebviewPanel } from "vscode";
import { Result } from "@malloydata/malloy";
import { QueryPanelMessage } from "./message_types";
import { WebviewMessageManager } from "./webview_message_manager";
import { VSCodeConnectionManager } from "./connection_manager";

export const CONNECTION_MANAGER = new VSCodeConnectionManager();

export interface RunState {
  cancel: () => void;
  panel: WebviewPanel;
  messages: WebviewMessageManager<QueryPanelMessage>;
  panelId: string;
  document: TextDocument;
  result?: Result;
}

class MalloyExtensionState {
  private activeWebviewPanelId: string | undefined;
  private clientId: string | undefined;

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

  private runStates: Map<string, RunState> = new Map();

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

  setClientId(clientId: string): void {
    this.clientId = clientId;
  }

  getClientId(): string {
    if (this.clientId === undefined) {
      throw new Error("Client ID has not been set");
    }
    return this.clientId;
  }
}

export const MALLOY_EXTENSION_STATE = new MalloyExtensionState();

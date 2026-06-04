/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {WebviewPanel, WebviewView} from 'vscode';
import {noAwait} from '../util/no_await';

export class WebviewMessageManager<S, R = S> {
  constructor(private panel: WebviewPanel | WebviewView) {
    this.panel.webview.onDidReceiveMessage((message: R) => {
      if (!this.clientCanReceiveMessages) {
        this.onClientCanReceiveMessages();
      }
      this.callback(message);
    });
    if ('onDidChangeViewState' in this.panel) {
      this.panel.onDidChangeViewState(() => {
        if (this.panelCanReceiveMessages && !this.panel.visible) {
          this.panelCanReceiveMessages = false;
        } else if (!this.panelCanReceiveMessages && this.panel.visible) {
          this.onPanelCanReceiveMessages();
        }
      });
    }
  }

  private pendingMessages: S[] = [];
  private panelCanReceiveMessages = true;
  private clientCanReceiveMessages = false;
  private callback: (message: R) => void = () => {
    /* Do nothing by default */
  };

  public postMessage(message: S): void {
    if (this.canSendMessages) {
      noAwait(this.panel.webview.postMessage(message));
    } else {
      this.pendingMessages.push(message);
    }
  }

  public onReceiveMessage(callback: (message: R) => void): void {
    this.callback = callback;
  }

  private flushPendingMessages() {
    this.pendingMessages.forEach(message => {
      noAwait(this.panel.webview.postMessage(message));
    });
    this.pendingMessages.splice(0, this.pendingMessages.length);
  }

  private onPanelCanReceiveMessages() {
    this.panelCanReceiveMessages = true;
    if (this.canSendMessages) {
      this.flushPendingMessages();
    }
  }

  private onClientCanReceiveMessages() {
    this.clientCanReceiveMessages = true;
    if (this.canSendMessages) {
      this.flushPendingMessages();
    }
  }

  private get canSendMessages() {
    return this.panelCanReceiveMessages && this.clientCanReceiveMessages;
  }
}

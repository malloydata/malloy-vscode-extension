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

import {WebviewPanel, WebviewView} from 'vscode';
import {noAwait} from '../util/no_await';

export class WebviewMessageManager<T> {
  constructor(private panel: WebviewPanel | WebviewView) {
    this.panel.webview.onDidReceiveMessage((message: T) => {
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

  private pendingMessages: T[] = [];
  private panelCanReceiveMessages = true;
  private clientCanReceiveMessages = false;
  private callback: (message: T) => void = () => {
    /* Do nothing by default */
  };

  public postMessage(message: T): void {
    if (this.canSendMessages) {
      noAwait(this.panel.webview.postMessage(message));
    } else {
      this.pendingMessages.push(message);
    }
  }

  public onReceiveMessage(callback: (message: T) => void): void {
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

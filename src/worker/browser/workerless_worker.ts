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

import * as vscode from "vscode";
import { VSCodeURLReader as WorkerURLReader } from "../../extension/utils";
import { BaseWorker, Message, WorkerMessage } from "../types";
import { connectionManager } from "../../extension/browser/connection_manager";
import { cancelQuery, runQuery } from "../run_query";

const workerLog = vscode.window.createOutputChannel("Malloy Worker");

export type ListenerType = (message: WorkerMessage) => void;

const reader = new WorkerURLReader();

export class WorkerConnection implements BaseWorker {
  listeners: Record<string, ListenerType[]> = {};
  constructor(_context: vscode.ExtensionContext) {
    workerLog.appendLine("Worker started");
  }

  send(message: Message): void {
    switch (message.type) {
      case "config":
        // Shared with extension
        // refreshConfig(connectionManager, message);
        break;
      case "cancel":
        cancelQuery(message);
        break;
      case "run":
        runQuery(
          { send: (message: WorkerMessage) => this._send(message) },
          reader,
          connectionManager,
          true,
          message
        );
        break;
    }
  }

  _send(message: WorkerMessage): void {
    this.listeners["message"] ??= [];
    this.listeners["message"].forEach((listener) => listener(message));
  }

  on(event: string, listener: ListenerType): void {
    this.listeners[event] ??= [];
    this.listeners[event].push(listener);
  }

  off(event: string, listener: ListenerType): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        (l) => l !== listener
      );
    }
  }

  stop(): void {
    // noop
  }
}

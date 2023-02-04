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

/* eslint-disable no-console */
import * as vscode from "vscode";
import { URLReader } from "@malloydata/malloy";
import { fetchFile } from "../../extension/utils";
import { BaseWorker, Message, WorkerMessage } from "../types";
const workerLog = vscode.window.createOutputChannel("Malloy Worker");
import { refreshConfig } from "../refresh_config";
import { connectionManager } from "../../server/browser/connections_browser";
import { cancelQuery, runQuery } from "../run_query";

// const DEFAULT_RESTART_SECONDS = 1;

export type ListenerType = (message: WorkerMessage) => void;

export class WorkerURLReader implements URLReader {
  async readURL(url: URL): Promise<string> {
    return fetchFile(url.toString());
  }
}

const reader = new WorkerURLReader();

export class WorkerConnection implements BaseWorker {
  listeners: Record<string, ListenerType[]> = {};
  constructor(_context: vscode.ExtensionContext) {
    workerLog.appendLine("Worker started");
  }

  send(message: Message): void {
    switch (message.type) {
      case "config":
        refreshConfig(connectionManager, message);
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

  on(event: string, listener: (message: WorkerMessage) => void): void {
    this.listeners[event] ??= [];
    this.listeners[event].push(listener);
  }

  off(event: string, listener: (message: WorkerMessage) => void): void {
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

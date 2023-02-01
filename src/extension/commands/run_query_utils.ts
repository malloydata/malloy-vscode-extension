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
import { Utils } from "vscode-uri";

import { MALLOY_EXTENSION_STATE, RunState } from "../state";
import { Result } from "@malloydata/malloy";
import turtleIcon from "../../media/turtle.svg";
import { getWebviewHtml } from "../webviews";
import { QueryMessageType, QueryRunStatus } from "../message_types";
import { WebviewMessageManager } from "../webview_message_manager";
import { queryDownload } from "./query_download";
import { WorkerMessage } from "../../worker/types";
import { getWorker } from "../../worker/worker";
import { trackQueryRun } from "../telemetry";

const malloyLog = vscode.window.createOutputChannel("Malloy");
interface NamedQuerySpec {
  type: "named";
  name: string;
  file: vscode.TextDocument;
}

interface QueryStringSpec {
  type: "string";
  text: string;
  file: vscode.TextDocument;
}

interface QueryFileSpec {
  type: "file";
  index: number;
  file: vscode.TextDocument;
}

interface NamedSQLQuerySpec {
  type: "named_sql";
  name: string;
  file: vscode.TextDocument;
}

interface UnnamedSQLQuerySpec {
  type: "unnamed_sql";
  index: number;
  file: vscode.TextDocument;
}

export type QuerySpec =
  | NamedQuerySpec
  | QueryStringSpec
  | QueryFileSpec
  | NamedSQLQuerySpec
  | UnnamedSQLQuerySpec;

export function runMalloyQuery(
  query: QuerySpec,
  panelId: string,
  name: string
): void {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Malloy Query (${name})`,
      cancellable: true,
    },
    (progress, token) => {
      const cancel = () => {
        worker.send({
          type: "cancel",
          panelId,
        });
        if (current) {
          const actuallyCurrent = MALLOY_EXTENSION_STATE.getRunState(
            current.panelId
          );
          if (actuallyCurrent === current) {
            current.panel.dispose();
            MALLOY_EXTENSION_STATE.setRunState(current.panelId, undefined);
            token.isCancellationRequested = true;
          }
        }
      };

      token.onCancellationRequested(cancel);

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
          "malloyQuery",
          name,
          { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
          { enableScripts: true, retainContextWhenHidden: true }
        );

        panel.onDidChangeViewState(
          (e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
            vscode.commands.executeCommand(
              "setContext",
              "malloy.webviewPanelFocused",
              e.webviewPanel.active
            );
          }
        );

        current = {
          panel,
          messages: new WebviewMessageManager(panel),
          panelId,
          cancel,
          document: query.file,
        };
        current.panel.iconPath = Utils.joinPath(
          MALLOY_EXTENSION_STATE.getExtensionUri(),
          "dist",
          turtleIcon
        );
        MALLOY_EXTENSION_STATE.setRunState(panelId, current);
      }

      const onDiskPath = Utils.joinPath(
        MALLOY_EXTENSION_STATE.getExtensionUri(),
        "dist",
        "query_page.js"
      );

      const entrySrc = current.panel.webview.asWebviewUri(onDiskPath);

      current.panel.webview.html = getWebviewHtml(
        entrySrc.toString(),
        current.panel.webview
      );

      current.panel.onDidDispose(() => {
        current.cancel();
      });

      MALLOY_EXTENSION_STATE.setActiveWebviewPanelId(current.panelId);
      current.panel.onDidChangeViewState((event) => {
        if (event.webviewPanel.active) {
          MALLOY_EXTENSION_STATE.setActiveWebviewPanelId(current.panelId);
          vscode.commands.executeCommand("malloy.refreshSchema");
        }
      });

      const { file, ...params } = query;
      const uri = file.uri.toString();
      const worker = getWorker();
      worker.send({
        type: "run",
        query: {
          uri,
          ...params,
        },
        panelId,
        name,
      });
      const allBegin = Date.now();
      const compileBegin = allBegin;
      let runBegin: number;

      return new Promise((resolve) => {
        const listener = (msg: WorkerMessage) => {
          if (msg.type === "dead") {
            current.messages.postMessage({
              type: QueryMessageType.QueryStatus,
              status: QueryRunStatus.Error,
              error: `The worker process has died, and has been restarted.
This is possibly the result of a database bug. \
Please consider filing an issue with as much detail as possible at \
https://github.com/malloydata/malloy/issues.`,
            });
            worker.off("message", listener);
            resolve(undefined);
            return;
          } else if (msg.type !== "query_panel") {
            return;
          }
          const { message, panelId: msgPanelId } = msg;
          if (msgPanelId !== panelId) {
            return;
          }
          current.messages.postMessage({
            ...message,
          });

          switch (message.type) {
            case QueryMessageType.QueryStatus:
              switch (message.status) {
                case QueryRunStatus.Compiling:
                  {
                    progress.report({ increment: 20, message: "Compiling" });
                  }
                  break;
                case QueryRunStatus.Running:
                  {
                    const compileEnd = Date.now();
                    runBegin = compileEnd;
                    malloyLog.appendLine(message.sql);
                    logTime("Compile", compileBegin, compileEnd);

                    trackQueryRun({ dialect: message.dialect });

                    progress.report({ increment: 40, message: "Running" });
                  }
                  break;
                case QueryRunStatus.Done:
                  {
                    const runEnd = Date.now();
                    if (runBegin != null) {
                      logTime("Run", runBegin, runEnd);
                    }
                    const { resultJson } = message;
                    const queryResult = Result.fromJSON(resultJson);
                    current.result = queryResult;
                    progress.report({ increment: 100, message: "Rendering" });
                    const allEnd = Date.now();
                    logTime("Total", allBegin, allEnd);

                    current.messages.onReceiveMessage((message) => {
                      if (message.type === QueryMessageType.StartDownload) {
                        queryDownload(
                          query,
                          message.downloadOptions,
                          queryResult,
                          panelId,
                          name
                        );
                      }
                    });

                    worker.off("message", listener);
                    resolve(undefined);
                  }
                  break;
                case QueryRunStatus.Error:
                  {
                    worker.off("message", listener);
                    resolve(undefined);
                  }
                  break;
              }
          }
        };

        worker.on("message", listener);
      });
    }
  );
}

function logTime(name: string, start: number, end: number) {
  malloyLog.appendLine(
    `${name} time: ${((end - start) / 1000).toLocaleString()}s`
  );
}

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
import { getWebviewHtml } from "../../webviews";
import {
  ConnectionMessageType,
  ConnectionPanelMessage,
  ConnectionServiceAccountKeyRequestStatus,
  ConnectionTestStatus,
} from "../../message_types";
import { WebviewMessageManager } from "../../webview_message_manager";
import {
  ConnectionConfig,
  getDefaultIndex,
} from "../../../common/connection_manager_types";

import { connectionManager } from "../connection_manager";
import { MALLOY_EXTENSION_STATE } from "../../state";

export function editConnectionsCommand(): void {
  const panel = vscode.window.createWebviewPanel(
    "malloyConnections",
    "Edit Connections",
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  const onDiskPath = Utils.joinPath(
    MALLOY_EXTENSION_STATE.getExtensionUri(),
    "dist",
    "connections_page.js"
  );

  const entrySrc = panel.webview.asWebviewUri(onDiskPath);

  panel.webview.html = getWebviewHtml(entrySrc.toString(), panel.webview);

  const messageManager = new WebviewMessageManager<ConnectionPanelMessage>(
    panel
  );

  const connections = connectionManager.getConnectionConfigs();
  const availableBackends = connectionManager.getAvailableBackends();

  messageManager.postMessage({
    type: ConnectionMessageType.SetConnections,
    connections,
    availableBackends,
  });

  messageManager.onReceiveMessage(async (message) => {
    switch (message.type) {
      case ConnectionMessageType.SetConnections: {
        const connections = await handleConnectionsPreSave(message.connections);
        const malloyConfig = vscode.workspace.getConfiguration("malloy");
        const hasWorkspaceConfig =
          malloyConfig.inspect("connections")?.workspaceValue !== undefined;
        malloyConfig.update(
          "connections",
          connections,
          vscode.ConfigurationTarget.Global
        );
        if (hasWorkspaceConfig) {
          malloyConfig.update(
            "connections",
            connections,
            vscode.ConfigurationTarget.Workspace
          );
        }
        messageManager.postMessage({
          type: ConnectionMessageType.SetConnections,
          connections,
          availableBackends,
        });
        break;
      }
      case ConnectionMessageType.TestConnection: {
        try {
          const connection = await connectionManager.connectionForConfig(
            message.connection
          );
          await connection.test();
          messageManager.postMessage({
            type: ConnectionMessageType.TestConnection,
            status: ConnectionTestStatus.Success,
            connection: message.connection,
          });
        } catch (error) {
          messageManager.postMessage({
            type: ConnectionMessageType.TestConnection,
            status: ConnectionTestStatus.Error,
            connection: message.connection,
            error: error.message,
          });
        }
        break;
      }
      case ConnectionMessageType.RequestBigQueryServiceAccountKeyFile: {
        const result = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: {
            JSON: ["json"],
          },
        });
        if (result) {
          messageManager.postMessage({
            type: ConnectionMessageType.RequestBigQueryServiceAccountKeyFile,
            status: ConnectionServiceAccountKeyRequestStatus.Success,
            connectionId: message.connectionId,
            serviceAccountKeyPath: result[0].fsPath,
          });
        }
        break;
      }
    }
  });
}

/**
 * Perform cleanup on the connections object received from the webview,
 * and prepare to save the config.
 *
 * @param connections The connection configs received from the webview.
 * @returns An updated list of connections
 *
 * - Fixes up `isDefault` issues.
 * - Handles scrubbing passwords and putting them in the keychain.
 */
async function handleConnectionsPreSave(
  connections: ConnectionConfig[]
): Promise<ConnectionConfig[]> {
  const defaultIndex = getDefaultIndex(connections);
  const modifiedConnections = [];
  for (let index = 0; index < connections.length; index++) {
    const connection = connections[index];
    connection.isDefault = index === defaultIndex;
    modifiedConnections.push(connection);
  }
  return modifiedConnections;
}

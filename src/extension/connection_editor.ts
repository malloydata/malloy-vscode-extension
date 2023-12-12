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
import {getWebviewHtml} from './webviews';
import {
  ConnectionMessageType,
  ConnectionPanelMessage,
  ConnectionServiceAccountKeyRequestStatus,
  ConnectionTestStatus,
  InstallExternalConnectionStatus,
} from '../common/message_types';
import {WebviewMessageManager} from './webview_message_manager';
import {ConnectionConfig} from '../common/connection_manager_types';
import {MALLOY_EXTENSION_STATE} from './state';
import {errorMessage} from '../common/errors';
import {ConnectionManager} from '../common/connection_manager';
import {getMalloyConfig} from './utils';

export class EditConnectionPanel {
  panel: vscode.WebviewPanel;
  messageManager: WebviewMessageManager<ConnectionPanelMessage>;
  onDidDispose: vscode.Event<void>;

  constructor(
    private connectionManager: ConnectionManager,
    handleConnectionsPreSave: (
      connections: ConnectionConfig[]
    ) => Promise<ConnectionConfig[]>
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'malloyConnections',
      'Edit Connections',
      vscode.ViewColumn.One,
      {enableScripts: true, retainContextWhenHidden: true}
    );
    this.onDidDispose = this.panel.onDidDispose;

    const onDiskPath = Utils.joinPath(
      MALLOY_EXTENSION_STATE.getExtensionUri(),
      'dist',
      'connections_page.js'
    );

    const entrySrc = this.panel.webview.asWebviewUri(onDiskPath);

    this.panel.webview.html = getWebviewHtml(
      entrySrc.toString(),
      this.panel.webview
    );

    this.messageManager = new WebviewMessageManager<ConnectionPanelMessage>(
      this.panel
    );

    this.messageManager.onReceiveMessage(async message => {
      switch (message.type) {
        case ConnectionMessageType.SetConnections: {
          const connections = await handleConnectionsPreSave(
            message.connections
          );
          const malloyConfig = getMalloyConfig();
          const hasWorkspaceConfig =
            malloyConfig.inspect('connections')?.workspaceValue !== undefined;
          malloyConfig.update(
            'connections',
            connections,
            vscode.ConfigurationTarget.Global
          );
          if (hasWorkspaceConfig) {
            malloyConfig.update(
              'connections',
              connections,
              vscode.ConfigurationTarget.Workspace
            );
          }
          this.messageManager.postMessage({
            type: ConnectionMessageType.SetConnections,
            connections: message.connections,
            availableBackends,
          });
          break;
        }
        case ConnectionMessageType.TestConnection: {
          try {
            const connection = await this.connectionManager.connectionForConfig(
              message.connection
            );
            await connection.test();
            this.messageManager.postMessage({
              type: ConnectionMessageType.TestConnection,
              status: ConnectionTestStatus.Success,
              connection: message.connection,
            });
          } catch (error) {
            this.messageManager.postMessage({
              type: ConnectionMessageType.TestConnection,
              status: ConnectionTestStatus.Error,
              connection: message.connection,
              error: errorMessage(error),
            });
          }
          break;
        }
        case ConnectionMessageType.RequestBigQueryServiceAccountKeyFile: {
          const result = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: {
              JSON: ['json'],
            },
          });
          if (result) {
            this.messageManager.postMessage({
              type: ConnectionMessageType.RequestBigQueryServiceAccountKeyFile,
              status: ConnectionServiceAccountKeyRequestStatus.Success,
              connectionId: message.connectionId,
              serviceAccountKeyPath: result[0].fsPath,
            });
          }
          break;
        }
        case ConnectionMessageType.InstallExternalConnection: {
          try {
            const installResult =
              await connectionManager.installExternalConnectionPackage(
                message.connection
              );
            this.messageManager.postMessage({
              type: ConnectionMessageType.InstallExternalConnection,
              status: InstallExternalConnectionStatus.Success,
              connection: {...installResult},
            });
          } catch (error) {
            this.messageManager.postMessage({
              type: ConnectionMessageType.InstallExternalConnection,
              status: InstallExternalConnectionStatus.Error,
              connection: message.connection,
              error: errorMessage(error),
            });
          }
          break;
        }
      }
    });

    const connections = this.connectionManager.getConnectionConfigs();
    const availableBackends = this.connectionManager.getAvailableBackends();

    this.messageManager.postMessage({
      type: ConnectionMessageType.SetConnections,
      connections,
      availableBackends,
    });
  }

  reveal(id: string | null = null) {
    this.panel.reveal();
    this.messageManager.postMessage({
      type: ConnectionMessageType.EditConnection,
      id,
    });
  }
}

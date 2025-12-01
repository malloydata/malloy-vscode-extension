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
import {getWebviewHtml} from './webviews';
import {
  ConnectionMessageType,
  ConnectionPanelMessage,
  ConnectionServiceFileRequestStatus,
  ConnectionTestStatus,
} from '../common/types/message_types';
import {WebviewMessageManager} from './webview_message_manager';
import {
  ConnectionConfig,
  ConnectionConfigManager,
} from '../common/types/connection_manager_types';
import {errorMessage} from '../common/errors';
import {getMalloyConfig} from './utils/config';
import {WorkerConnection} from './worker_connection';
import {noAwait} from '../util/no_await';

export class EditConnectionPanel {
  panel: vscode.WebviewPanel;
  messageManager: WebviewMessageManager<ConnectionPanelMessage>;
  onDidDispose: vscode.Event<void>;

  constructor(
    connectionConfigManager: ConnectionConfigManager,
    private context: vscode.ExtensionContext,
    private worker: WorkerConnection
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'malloyConnections',
      'Edit Connections',
      vscode.ViewColumn.One,
      {enableScripts: true, retainContextWhenHidden: true}
    );
    this.onDidDispose = this.panel.onDidDispose;

    this.panel.webview.html = getWebviewHtml(
      'connections_page',
      this.panel.webview
    );

    this.messageManager = new WebviewMessageManager<ConnectionPanelMessage>(
      this.panel
    );

    const availableBackends = connectionConfigManager.getAvailableBackends();

    this.messageManager.onReceiveMessage(async message => {
      switch (message.type) {
        case ConnectionMessageType.SetConnections: {
          const connections = await this.handleConnectionsPreSave(
            message.connections
          );
          const malloyConfig = getMalloyConfig();
          const hasWorkspaceConfig =
            malloyConfig.inspect('connections')?.workspaceValue !== undefined;
          await malloyConfig.update(
            'connections',
            connections,
            vscode.ConfigurationTarget.Global
          );
          if (hasWorkspaceConfig) {
            await malloyConfig.update(
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
            const result: string = await this.worker.sendRequest(
              'malloy/testConnection',
              {
                config: message.connection,
              }
            );
            if (result) {
              throw new Error(result);
            }
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
        case ConnectionMessageType.RequestFile: {
          if (message.status === ConnectionServiceFileRequestStatus.Waiting) {
            const {configKey, filters, connectionId} = message;
            const result = await vscode.window.showOpenDialog({
              canSelectMany: false,
              filters,
            });
            if (result) {
              this.messageManager.postMessage({
                type: ConnectionMessageType.RequestFile,
                status: ConnectionServiceFileRequestStatus.Success,
                connectionId,
                configKey,
                fsPath: result[0].fsPath,
              });
            }
          }
          break;
        }
      }
    });

    const init = async () => {
      let connections = connectionConfigManager.getConnectionConfigs();
      connections = await this.handleConnectionsPreLoad(connections);

      this.messageManager.postMessage({
        type: ConnectionMessageType.SetConnections,
        connections,
        availableBackends,
      });
    };
    noAwait(init());
  }

  reveal(id: string | null = null) {
    this.panel.reveal();
    this.messageManager.postMessage({
      type: ConnectionMessageType.EditConnection,
      id,
    });
  }

  /**
   * Perform setup on the connections being sent to the webview.
   *
   * @param connections The connection configs.
   * @returns An updated list of connections
   *
   * - Handles retrieving passwords the keychain.
   */
  async handleConnectionsPreLoad(
    connections: ConnectionConfig[]
  ): Promise<ConnectionConfig[]> {
    const modifiedConnections = [];
    for (let connection of connections) {
      if ('password' in connection && connection.password) {
        const key = `connections.${connection.id}.password`;
        const password = await this.context.secrets.get(key);
        connection = {
          ...connection,
          password,
        };
      }
      if ('motherDuckToken' in connection && connection.motherDuckToken) {
        const key = `connections.${connection.id}.motherDuckToken`;
        const motherDuckToken = await this.context.secrets.get(key);
        connection = {
          ...connection,
          motherDuckToken,
        };
      }
      if ('privateKeyPass' in connection && connection.privateKeyPass) {
        const key = `connections.${connection.id}.privateKeyPass`;
        const privateKeyPass = await this.context.secrets.get(key);
        connection = {
          ...connection,
          privateKeyPass,
        };
      }
      modifiedConnections.push(connection);
    }
    return modifiedConnections;
  }

  /**
   * Perform cleanup on the connections object received from the webview,
   * and prepare to save the config.
   *
   * @param connections The connection configs received from the webview.
   * @returns An updated list of connections
   *
   * - Handles scrubbing passwords and putting them in the keychain.
   */
  async handleConnectionsPreSave(
    connections: ConnectionConfig[]
  ): Promise<ConnectionConfig[]> {
    const modifiedConnections = [];
    for (let connection of connections) {
      if ('password' in connection) {
        const key = `connections.${connection.id}.password`;
        if (connection.password) {
          await this.context.secrets.store(key, connection.password);
          connection = {
            ...connection,
            // Change the config to trigger a connection reload
            password: `$secret-${Date.now().toString()}$`,
          };
        } else {
          await this.context.secrets.delete(key);
          connection = {
            ...connection,
            // Change the config to trigger a connection reload
            password: '',
          };
        }
      }
      if ('motherDuckToken' in connection) {
        const key = `connections.${connection.id}.motherDuckToken`;
        if (connection.motherDuckToken) {
          await this.context.secrets.store(key, connection.motherDuckToken);
          connection = {
            ...connection,
            // Change the config to trigger a connection reload
            motherDuckToken: `$secret-${Date.now().toString()}$`,
          };
        } else {
          await this.context.secrets.delete(key);
          connection = {
            ...connection,
            // Change the config to trigger a connection reload
            motherDuckToken: '',
          };
        }
      }
      if ('privateKeyPass' in connection) {
        const key = `connections.${connection.id}.privateKeyPass`;
        if (connection.privateKeyPass) {
          await this.context.secrets.store(key, connection.privateKeyPass);
          connection = {
            ...connection,
            // Change the config to trigger a connection reload
            privateKeyPass: `$secret-${Date.now().toString()}$`,
          };
        } else {
          await this.context.secrets.delete(key);
          connection = {
            ...connection,
            // Change the config to trigger a connection reload
            privateKeyPass: '',
          };
        }
      }
      modifiedConnections.push(connection);
    }
    return modifiedConnections;
  }
}

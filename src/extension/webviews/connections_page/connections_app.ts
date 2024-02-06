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

import {LitElement, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {
  provideVSCodeDesignSystem,
  vsCodeProgressRing,
} from '@vscode/webview-ui-toolkit';

provideVSCodeDesignSystem().register(vsCodeProgressRing());

import {
  ConnectionBackend,
  ConnectionConfig,
  ExternalConnectionConfig,
} from '../../../common/types/connection_manager_types';
import {
  ConnectionMessageType,
  ConnectionPanelMessage,
  ConnectionMessageTest,
  ConnectionTestStatus,
  ConnectionServiceFileRequestStatus,
  InstallExternalConnectionStatus,
  ConnectionMessageInstallExternalConnection,
} from '../../../common/types/message_types';
import './connection_editor_list';
import {getVSCodeAPI} from '../vscode_wrapper';

@customElement('connections-app')
export class ConnectionsApp extends LitElement {
  vscode = getVSCodeAPI<ConnectionPanelMessage, void>();

  @property({attribute: false})
  selectedId: string | null = null;

  @property({attribute: false})
  connections: ConnectionConfig[] | undefined;

  @property({attribute: false})
  testStatuses: ConnectionMessageTest[] = [];

  @property({attribute: false})
  installExternalConnectionStatuses: ConnectionMessageInstallExternalConnection[] =
    [];

  @property({attribute: false})
  availableBackends: ConnectionBackend[] = [];

  postConnections = () => {
    this.vscode.postMessage({
      type: ConnectionMessageType.SetConnections,
      connections: this.connections || [],
      availableBackends: this.availableBackends,
    });
  };

  testConnection = (connection: ConnectionConfig) => {
    const message: ConnectionMessageTest = {
      type: ConnectionMessageType.TestConnection,
      connection,
      status: ConnectionTestStatus.Waiting,
    };
    this.vscode.postMessage(message);
    this.testStatuses = [...this.testStatuses, message];
  };

  installExternalConnection = (connection: ExternalConnectionConfig) => {
    const message: ConnectionMessageInstallExternalConnection = {
      type: ConnectionMessageType.InstallExternalConnection,
      connection,
      status: InstallExternalConnectionStatus.Waiting,
    };
    this.vscode.postMessage(message);
    this.installExternalConnectionStatuses = [
      ...this.installExternalConnectionStatuses,
      message,
    ];
  };

  requestFilePath = (
    connectionId: string,
    configKey: string,
    filters: {[key: string]: string[]}
  ) => {
    this.vscode.postMessage({
      type: ConnectionMessageType.RequestFile,
      connectionId,
      status: ConnectionServiceFileRequestStatus.Waiting,
      configKey,
      filters,
    });
  };

  onMessage = (event: MessageEvent<ConnectionPanelMessage>) => {
    const message = event.data;

    switch (message.type) {
      case ConnectionMessageType.EditConnection:
        this.selectedId = message.id;
        break;
      case ConnectionMessageType.SetConnections:
        this.connections = message.connections;
        this.availableBackends = message.availableBackends;
        break;
      case ConnectionMessageType.TestConnection:
        this.testStatuses = [...this.testStatuses, message];
        break;
      case ConnectionMessageType.InstallExternalConnection:
        this.installExternalConnectionStatuses = [
          ...this.installExternalConnectionStatuses,
          message,
        ];
        break;
      case ConnectionMessageType.RequestFile: {
        if (message.status === ConnectionServiceFileRequestStatus.Success) {
          this.connections = (this.connections || []).map(connection => {
            const {connectionId, fsPath, configKey} = message;
            if (connection.id === connectionId) {
              return {
                ...connection,
                [configKey]: fsPath,
                configKey: message.configKey,
              };
            } else {
              return connection;
            }
          });
        }
        break;
      }
    }
  };

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('message', this.onMessage);
    this.vscode.postMessage({type: ConnectionMessageType.AppReady});
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('message', this.onMessage);
  }

  override render() {
    return this.connections === undefined
      ? html` <div style="height: 100%">
          <vscode-progress-ring>Loading</vscode-progress-ring>
        </div>`
      : html` <div style="max-width: 80em">
          <div style="margin: '0 10px 10px 10px'">
            <connection-editor-list
              .connections=${this.connections}
              .setConnections=${(connections: ConnectionConfig[]) => {
                this.connections = connections;
              }}
              .saveConnections=${this.postConnections}
              .testConnection=${this.testConnection}
              .testStatuses=${this.testStatuses}
              .requestFilePath=${this.requestFilePath}
              .availableBackends=${this.availableBackends}
              .installExternalConnection=${this.installExternalConnection}
              .installExternalConnectionStatuses=${this
                .installExternalConnectionStatuses}
              .selectedId=${this.selectedId}
              .setSelectedId=${(selectedId: string | null) => {
                this.selectedId = selectedId;
              }}
            ></connection-editor-list>
          </div>
        </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'connection-app': ConnectionsApp;
  }
}

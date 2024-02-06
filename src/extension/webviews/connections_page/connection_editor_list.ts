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

import {v4 as uuidv4} from 'uuid';
import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
} from '@vscode/webview-ui-toolkit';
import {
  ConnectionBackend,
  ConnectionConfig,
  ExternalConnectionConfig,
  getDefaultIndex,
} from '../../../common/types/connection_manager_types';
import {
  ConnectionMessageInstallExternalConnection,
  ConnectionMessageTest,
} from '../../../common/types/message_types';
import {chevronRightIcon} from '../components/icons';
import './connection_editor/connection_editor';
import {styles as editorStyles} from './connection_editor/connection_editor.css';

provideVSCodeDesignSystem().register(vsCodeButton());

const styles = css`
  .button-editor-group {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .empty-state-box {
    margin: 10px;
    background-color: var(--vscode-list-hoverBackground);
    padding: 10px;
    border: 1px solid var(--vscode-contrastBorder);
    color: var(--foreground);
    font-family: var(--font-family);
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100px;
  }
`;

@customElement('connection-editor-list')
export class ConnectionEditorList extends LitElement {
  static override styles = [styles, editorStyles];

  @property({type: Array})
  connections!: ConnectionConfig[];
  @property()
  setConnections!: (connections: ConnectionConfig[], isNew?: boolean) => void;
  @property()
  saveConnections!: () => void;
  @property()
  testConnection!: (connection: ConnectionConfig) => void;
  @property({type: Array})
  testStatuses!: ConnectionMessageTest[];
  @property()
  requestFilePath!: (
    connectionId: string,
    configKey: string,
    filters: {[key: string]: string[]}
  ) => void;
  @property({type: Array})
  availableBackends!: ConnectionBackend[];
  @property()
  installExternalConnection!: (config: ExternalConnectionConfig) => void;
  @property({type: Array})
  installExternalConnectionStatuses!: ConnectionMessageInstallExternalConnection[];
  @property({attribute: false})
  selectedId!: string | null;

  @property({attribute: false})
  dirty = false;

  addConnection() {
    const id = uuidv4();
    this.setConnections([
      ...this.connections,
      {
        name: '',
        backend: this.availableBackends[0],
        id,
        isDefault: this.connections.length === 0,
      },
    ]);
    this.selectedId = id;
  }

  setConfig(config: ConnectionConfig, index: number) {
    const copy = [...this.connections];
    config.isGenerated = false;
    copy[index] = config;
    this.setConnections(copy);
    this.dirty = true;
  }

  makeDefault(defaultIndex: number) {
    this.setConnections(
      this.connections.map((connection, index) => {
        return {...connection, isDefault: index === defaultIndex};
      })
    );
    this.dirty = true;
  }

  override render() {
    const defaultConnectionIndex = getDefaultIndex(this.connections);

    return html` <div style="marginTop: 20px">
      <div class="button-group" style="margin: 10px">
        <vscode-button @click=${this.addConnection}
          >New Connection</vscode-button
        >
      </div>
      ${this.connections.map((config, index) =>
        this.selectedId === config.id
          ? html`
              <connection-editor
                .config=${config}
                .setConfig=${(newConfig: ConnectionConfig) =>
                  this.setConfig(newConfig, index)}
                .deleteConfig=${() => {
                  this.setConnections(this.connections.splice(index, 1));
                  this.dirty = true;
                }}
                .testConfig=${() => {
                  this.testConnection(this.connections[index]);
                }}
                .testStatus=${[...this.testStatuses]
                  .reverse()
                  .find(message => message.connection.id === config.id)}
                .requestFilePath=${this.requestFilePath}
                .isDefault=${index === defaultConnectionIndex}
                .makeDefault=${() => this.makeDefault(index)}
                .availableBackends=${this.availableBackends}
                .installExternalConnection=${this.installExternalConnection}
                .installExternalConnectionStatus=${[
                  ...this.installExternalConnectionStatuses,
                ]
                  .reverse()
                  .find(message => message.connection.id === config.id)}
                .setSelectedId=${(selectedId: string | null) => {
                  this.selectedId = selectedId;
                }}
              ></connection-editor>
            `
          : html`<div class="connection-editor-box">
              <b
                class="connection-title"
                @click=${() => (this.selectedId = config.id)}
              >
                ${chevronRightIcon} CONNECTION: ${config.name || 'Untitled'}
              </b>
            </div>`
      )}
      ${this.connections.length === 0
        ? html`<div class="empty-state-box">NO CONNECTIONS</div>`
        : null}
      <div class="button-group" style="margin: 10px">
        <vscode-button
          @click=${() => {
            this.dirty = false;
            this.saveConnections();
          }}
          .disabled=${!this.dirty}
        >
          Save
        </vscode-button>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'connection-editor-list': ConnectionEditorList;
  }
}

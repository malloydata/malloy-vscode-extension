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
  vsCodeButton,
  vsCodeDivider,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeTag,
} from '@vscode/webview-ui-toolkit';
import {
  ConnectionBackend,
  ConnectionBackendNames,
  ConnectionConfig,
  ExternalConnectionConfig,
  PostgresConnectionConfig,
} from '../../../../common/connection_manager_types';
import {
  ConnectionMessageInstallExternalConnection,
  ConnectionMessageTest,
} from '../../../../common/message_types';
import {styles} from './connection_editor.css';
import './bigquery_connection_editor';
import './duckdb_connection_editor';
import './external_connection_editor';
import './postgres_connection_editor';

provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeDivider(),
  vsCodeDropdown(),
  vsCodeOption(),
  vsCodeTag()
);

@customElement('connection-editor')
export class ConnectionEditor extends LitElement {
  static override styles = [styles];

  @property({type: Object})
  config!: ConnectionConfig;

  @property()
  setConfig!: (config: ConnectionConfig) => void;

  @property()
  deleteConfig!: () => void;

  @property()
  testConfig!: () => void;

  @property({type: Object})
  testStatus!: ConnectionMessageTest | undefined;

  @property()
  requestServiceAccountKeyPath!: (connectionId: string) => void;

  @property({type: Boolean})
  isDefault!: boolean;

  @property()
  makeDefault!: () => void;

  @property({type: Array})
  availableBackends!: ConnectionBackend[];

  @property()
  installExternalConnection!: (config: ExternalConnectionConfig) => void;

  @property({type: Object})
  installExternalConnectionStatus!:
    | ConnectionMessageInstallExternalConnection
    | undefined;

  @property()
  setSelectedId!: (id: string | null) => void;

  allBackendOptions: ConnectionBackend[] = [
    ConnectionBackend.BigQuery,
    ConnectionBackend.Postgres,
    ConnectionBackend.DuckDB,
    ConnectionBackend.External,
  ];

  override render() {
    const backendOptions = this.allBackendOptions
      .filter(option => this.availableBackends.includes(option))
      .map(value => ({value, label: ConnectionBackendNames[value]}));

    return html` <div class="connection-editor-box">
      <div
        style="display: flex; align-items: center; gap: 5px; justify-content: space-between"
      >
        <b class="connection-title" @click=${() => this.setSelectedId(null)}>
          <i class="codicon codicon-chevron-down"></i>
          CONNECTION: ${this.config.name || 'Untitled'}
        </b>
        ${this.isDefault
          ? html`<vscode-tag>Default</vscode-tag>`
          : html`<vscode-button @click=${this.makeDefault} style="height: 25px">
              Make Default
            </vscode-button>`}
      </div>
      <table>
        <tbody>
          <tr>
            <td class="label-cell">
              <label>Type:</label>
            </td>
            <td>
              <vscode-dropdown
                @change=${({target: {value}}: {target: HTMLInputElement}) => {
                  this.setConfig({
                    ...this.config,
                    backend: value as ConnectionBackend,
                  });
                }}
                value=${this.config.backend}
              >
                ${backendOptions.map(
                  option =>
                    html`<vscode-option
                      value=${option.value}
                      .selected=${this.config.backend === option.value}
                      >${option.label}</vscode-option
                    >`
                )}
              </vscode-dropdown>
            </td>
          </tr>
        </tbody>
      </table>
      ${this.config.backend === ConnectionBackend.BigQuery
        ? html` <bigquery-connection-editor
            .config=${this.config}
            .setConfig=${this.setConfig}
            .requestServiceAccountKeyPath=${() =>
              this.requestServiceAccountKeyPath(this.config.id)}
          ></bigquery-connection-editor>`
        : this.config.backend === ConnectionBackend.Postgres
        ? html`<postgres-connection-editor
            .config=${this.config as PostgresConnectionConfig}
            .setConfig=${this.setConfig}
          ></postgres-connection-editor>`
        : this.config.backend === ConnectionBackend.DuckDB
        ? html`<duckdb-connection-editor
            .config=${this.config}
            .setConfig=${this.setConfig}
          ></duckdb-connection-editor>`
        : this.config.backend === ConnectionBackend.External
        ? html`<external-connection-editor
            .config=${this.config}
            .setConfig=${this.setConfig}
            .installExternalConnection=${this.installExternalConnection}
            .installExternalConnectionStatus=${this
              .installExternalConnectionStatus}
          ></external-connection-editor>`
        : html`<div>Unknown Connection Type</div>`}
      <vscode-divider></vscode-divider>
      <table>
        <tbody>
          <tr>
            <td class="label-cell"></td>
            <td>
              <div class="button-group" style="margin-top: 5px">
                <vscode-button
                  @click=${this.deleteConfig}
                  appearance="secondary"
                >
                  Delete
                </vscode-button>
                <vscode-button @click=${this.testConfig}>Test</vscode-button>
                ${this.testStatus
                  ? html`<vscode-tag>${this.testStatus?.status}</vscode-tag>`
                  : null}
                ${this.testStatus?.status === 'error'
                  ? this.testStatus.error
                  : null}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'connection-editor': ConnectionEditor;
  }
}

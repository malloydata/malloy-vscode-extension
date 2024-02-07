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
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeCheckbox,
  vsCodeRadio,
  vsCodeTextField,
} from '@vscode/webview-ui-toolkit';
import {BigQueryConnectionConfig} from '../../../../common/types/connection_manager_types';
import {customElement, property} from 'lit/decorators.js';
import {styles} from './connection_editor.css';

provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeCheckbox(),
  vsCodeRadio(),
  vsCodeTextField()
);

@customElement('bigquery-connection-editor')
export class BigQueryConnectionEditor extends LitElement {
  static override styles = [styles];

  @property({type: Object})
  config!: BigQueryConnectionConfig;

  @property()
  setConfig!: (config: BigQueryConnectionConfig) => void;

  @property()
  requestFilePath!: (
    connectionId: string,
    configKey: string,
    filters: {[key: string]: string[]}
  ) => void;

  requestServiceAccountKeyPath = () => {
    this.requestFilePath(this.config.id, 'serviceAccountKeyPath', {
      JSON: ['json'],
    });
  };

  override render() {
    return html` <table>
      <tbody>
        <tr>
          <td class="label-cell">
            <label>Name:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.name}
              @change=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, name: value});
              }}
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Default Project ID:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.projectId || ''}
              @change=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, projectId: value});
              }}
              placeholder="Optional"
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Billing Project ID:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.billingProjectId || ''}
              @change=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, billingProjectId: value});
              }}
              placeholder="Optional"
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Location:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.location || ''}
              @change=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, location: value});
              }}
              placeholder="Optional (default US)"
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Service Account Key File Path:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.serviceAccountKeyPath || ''}
              @change=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, serviceAccountKeyPath: value});
              }}
              placeholder="Optional"
            ></vscode-text-field>
          </td>
          <td>
            <vscode-button @click=${this.requestServiceAccountKeyPath}>
              Pick File
            </vscode-button>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Maximum Bytes Billed:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.maximumBytesBilled || ''}
              @change=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, maximumBytesBilled: value});
              }}
              placeholder="Optional"
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Query Timeout Milliseconds:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.timeoutMs || ''}
              @change=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, timeoutMs: value});
              }}
              placeholder="Optional"
            ></vscode-text-field>
          </td>
        </tr>
      </tbody>
    </table>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bigquery-connection-editor': BigQueryConnectionEditor;
  }
}

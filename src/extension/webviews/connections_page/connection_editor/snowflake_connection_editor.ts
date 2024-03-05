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
  vsCodeCheckbox,
  vsCodeRadio,
  vsCodeTextField,
} from '@vscode/webview-ui-toolkit';
import {SnowflakeConnectionConfig} from '../../../../common/types/connection_manager_types';
import {customElement, property} from 'lit/decorators.js';
import {styles} from './connection_editor.css';

provideVSCodeDesignSystem().register(
  vsCodeCheckbox(),
  vsCodeRadio(),
  vsCodeTextField()
);

@customElement('snowflake-connection-editor')
export class SnowflakeConnectionEditor extends LitElement {
  static override styles = [styles];

  @property({type: Object})
  config!: SnowflakeConnectionConfig;
  @property()
  setConfig!: (config: SnowflakeConnectionConfig) => void;

  @property({attribute: false})
  showPassword = false;

  override render() {
    return html`<table>
      <tbody>
        <tr>
          <td class="label-cell">
            <label>Name:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.name}
              @input=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, name: value});
              }}
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Account:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.account || ''}
              @input=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, account: value});
              }}
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Username:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.username || ''}
              @input=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, username: value});
              }}
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Password:</label>
          </td>
          <td>
            <secret-editor
              .secret=${this.config.password}
              .setSecret=${(secret: string) => {
                this.setConfig({...this.config, password: secret});
              }}
            ></secret-editor>
          </td>
          <td style="padding-left: 10px">
            <vscode-checkbox
              .checked=${this.showPassword}
              @change=${({target}: {target: HTMLInputElement}) => {
                this.showPassword = target.checked;
              }}
            >
              Show Password
            </vscode-checkbox>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Warehouse:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.warehouse || ''}
              @input=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, warehouse: value});
              }}
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Database:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.database || ''}
              @input=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, database: value});
              }}
              placeholder="Optional"
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Schema:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.schema || ''}
              @input=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, schema: value});
              }}
              placeholder="Optional"
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Response Timeout:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.timeoutMs
                ? this.config.timeoutMs.toString()
                : ''}
              @input=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, timeoutMs: parseInt(value)});
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
    'snowflake-connection-editor': SnowflakeConnectionEditor;
  }
}

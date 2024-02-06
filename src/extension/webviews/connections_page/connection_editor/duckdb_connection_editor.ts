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
import {DuckDBConnectionConfig} from '../../../../common/types/connection_manager_types';
import {customElement, property} from 'lit/decorators.js';
import {styles} from './connection_editor.css';

provideVSCodeDesignSystem().register(
  vsCodeCheckbox(),
  vsCodeRadio(),
  vsCodeTextField()
);

@customElement('duckdb-connection-editor')
export class DuckDBConnectionEditor extends LitElement {
  static override styles = [styles];

  @property({type: Object})
  config!: DuckDBConnectionConfig;

  @property()
  setConfig!: (config: DuckDBConnectionConfig) => void;

  @property()
  requestFilePath!: (
    connectionId: string,
    configKey: string,
    filters: {[key: string]: string[]}
  ) => void;

  requestDatabasePath = () => {
    this.requestFilePath(this.config.id, 'databasePath', {
      DuckDB: ['.db', '.duckdb', '.ddb'],
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
            <label>Working Directory:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.workingDirectory || ''}
              @change=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, workingDirectory: value});
              }}
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Database File:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.databasePath || ''}
              placeholder=":memory:"
              @change=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, databasePath: value});
              }}
            ></vscode-text-field>
          </td>
          <td>
            <vscode-button @click=${this.requestDatabasePath}>
              Pick File
            </vscode-button>
          </td>
        </tr>
      </tbody>
    </table>`;
  }
}

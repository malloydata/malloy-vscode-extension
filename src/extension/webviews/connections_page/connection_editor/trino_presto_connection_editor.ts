import {LitElement, html} from 'lit';
import {
  provideVSCodeDesignSystem,
  vsCodeTextField,
} from '@vscode/webview-ui-toolkit';
import {PrestoConnectionConfig, TrinoConnectionConfig} from '../../../../common/types/connection_manager_types';
import {customElement, property} from 'lit/decorators.js';
import {styles} from './connection_editor.css';

provideVSCodeDesignSystem().register(vsCodeTextField());

@customElement('trino-presto-connection-editor')
export class TrinoPrestoConnectionEditor extends LitElement {
  static override styles = [styles];

  @property({type: Object})
  config!: PrestoConnectionConfig | TrinoConnectionConfig;
  @property()
  setConfig!: (config: PrestoConnectionConfig | TrinoConnectionConfig) => void;

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
            <label>Server:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.server || ''}
              @input=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, server: value});
              }}
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Port:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.port ? this.config.port.toString() : ''}
              @input=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, port: parseInt(value)});
              }}
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Catalog:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.catalog || ''}
              @input=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, catalog: value});
              }}
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
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>User:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.user || ''}
              @input=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({...this.config, user: value});
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
        </tr>
      </tbody>
    </table>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'presto-connection-editor': TrinoPrestoConnectionEditor;
    'trino-connection-editor': TrinoPrestoConnectionEditor;
  }
}
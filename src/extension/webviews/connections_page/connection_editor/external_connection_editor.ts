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
  vsCodeDropdown,
  vsCodeOption,
  vsCodeTextField,
} from '@vscode/webview-ui-toolkit';
import {ConnectionConfig, ConnectionParameterValue} from '@malloydata/malloy';
import {
  ExternalConnectionConfig,
  ExternalConnectionSource,
  ExternalConnectionSourceNames,
} from '../../../../common/connection_manager_types';
import {ConnectionMessageInstallExternalConnection} from '../../../../common/message_types';
import {customElement, property} from 'lit/decorators.js';
import {styles} from './connection_editor.css';

provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeDropdown(),
  vsCodeOption(),
  vsCodeTextField()
);

const allConnectionSources = [
  ExternalConnectionSource.NPM,
  ExternalConnectionSource.LocalNPM,
];

@customElement('external-connection-editor')
export class ExternalConnectionEditor extends LitElement {
  static override styles = [styles];

  @property({type: Object})
  config!: ExternalConnectionConfig;

  @property()
  setConfig!: (config: ExternalConnectionConfig) => void;

  @property()
  installExternalConnection!: (config: ExternalConnectionConfig) => void;

  @property({type: Object})
  installExternalConnectionStatus:
    | ConnectionMessageInstallExternalConnection
    | undefined;

  override render() {
    const sourceOptions = allConnectionSources.map(value => ({
      value,
      label: ExternalConnectionSourceNames[value],
    }));

    if (!this.config.source) {
      this.config.source = ExternalConnectionSource.NPM;
    }

    if (
      this.installExternalConnectionStatus?.status === 'success' &&
      this.config.packageInfo !==
        this.installExternalConnectionStatus.connection.packageInfo
    ) {
      this.config.packageInfo =
        this.installExternalConnectionStatus.connection.packageInfo;
      this.config.connectionSchema =
        this.installExternalConnectionStatus.connection.connectionSchema;
      this.config.name = this.installExternalConnectionStatus.connection.name;
    }

    return html` <table>
      <tbody>
        <tr>
          <td class="label-cell">
            <label>Source:</label>
          </td>
          <td>
            <vscode-dropdown
              value=${this.config.source!}
              @change=${(source: string) =>
                this.setConfig({
                  ...this.config,
                  source: source as ExternalConnectionSource,
                })}
            >
              ${sourceOptions.map(
                option =>
                  html`<vscode-option
                    value=${option.value}
                    .selected=${this.config.source === option.value}
                    >${option.label}</vscode-option
                  >`
              )}
            </vscode-dropdown>
          </td>
        </tr>
        <tr>
          <td class="label-cell">
            <label>Path:</label>
          </td>
          <td>
            <vscode-text-field
              value=${this.config.path || ''}
              @change=${({target: {value}}: {target: HTMLInputElement}) => {
                this.setConfig({
                  ...this.config,
                  path: value.trim(),
                });
              }}
            ></vscode-text-field>
          </td>
        </tr>
        <tr>
          <td></td>
          <td>
            <div class="button-group">
              <vscode-button
                .disabled=${shouldDisableInstallButton(
                  this.installExternalConnectionStatus,
                  this.config
                )}
                @click=${() => this.installExternalConnection(this.config)}
                appearance="secondary"
              >
                ${installButtonLabel(
                  this.installExternalConnectionStatus,
                  this.config
                )}
              </vscode-button>
              ${this.installExternalConnectionStatus?.status === 'error'
                ? this.installExternalConnectionStatus.error
                : null}
            </div>
          </td>
        </tr>
        ${this.config.packageInfo
          ? html`<tr>
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
            </tr>`
          : null}
        ${this.config.connectionSchema?.map(parameter => {
          // TODO(figutierrez): Move this to its own component.
          return html`
            <tr key=${parameter.label}>
              <td class="label-cell">
                <label>{parameter.label}:</label>
              </td>
              <td>
                <vscode-text-field
                  placeholder=${parameter.isOptional
                    ? `Optional ${
                        parameter.defaultValue
                          ? `(default ${parameter.defaultValue})`
                          : ''
                      }`
                    : ''}
                  value=${(this.config.configParameters?.[parameter.name] ||
                    '') as string}
                  @change=${({target: {value}}: {target: HTMLInputElement}) => {
                    const configParameters =
                      this.config.configParameters ?? ({} as ConnectionConfig);
                    let configParameterValue: ConnectionParameterValue = value;
                    if (parameter.type === 'number') {
                      try {
                        configParameterValue = parseInt(value);
                      } catch {
                        // TODO(figutierrez): Show error when this happens.
                        configParameterValue = 0;
                      }
                    } else if (parameter.type === 'boolean') {
                      configParameterValue = value === 'false';
                    }
                    configParameters[parameter.name] = configParameterValue;
                    this.setConfig({
                      ...this.config,
                      configParameters: configParameters,
                    });
                  }}
                  type=${parameter.isSecret ? 'password' : 'text'}
                ></vscode-text-field>
              </td>
            </tr>
          `;
        })}
      </tbody>
    </table>`;
  }
}

const installButtonLabel = (
  installConnection: ConnectionMessageInstallExternalConnection | undefined,
  config: ExternalConnectionConfig
) => {
  if (installConnection?.status === 'waiting') {
    return 'Installing...';
  }

  if (config.packageInfo) {
    return 'Installed';
  }

  return 'Install Plugin';
};

const shouldDisableInstallButton = (
  installConnection: ConnectionMessageInstallExternalConnection | undefined,
  config: ExternalConnectionConfig
) => {
  if (installConnection?.status === 'waiting') {
    return true;
  }

  if ((config.path?.trim()?.length ?? 0) === 0) {
    return true;
  }

  if (config.packageInfo) {
    return true;
  }

  return false;
};

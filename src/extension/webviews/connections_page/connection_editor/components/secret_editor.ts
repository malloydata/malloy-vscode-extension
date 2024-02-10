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
  vsCodeTextField,
} from '@vscode/webview-ui-toolkit';
import {customElement, property} from 'lit/decorators.js';
import {styles} from '../connection_editor.css';
import {when} from 'lit/directives/when.js';

provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeCheckbox(),
  vsCodeTextField()
);

@customElement('secret-editor')
class SecretEditor extends LitElement {
  static override styles = [styles];

  @property()
  secret?: string;
  @property()
  setSecret!: (secret: string) => void;

  @property({attribute: false})
  showSecret = false;

  @property({attribute: false})
  settingSecret = false;

  override render() {
    return html`
      <div>
        ${when(
          this.settingSecret,
          () =>
            html`<div class="button-group">
              <vscode-text-field
                @change=${({target: {value}}: {target: HTMLInputElement}) => {
                  this.setSecret(value);
                }}
                type=${this.showSecret ? 'text' : 'password'}
              ></vscode-text-field>
              <vscode-button
                @click=${() => {
                  this.settingSecret = false;
                }}
              >
                Cancel
              </vscode-button>
              <vscode-checkbox
                .checked=${this.showSecret}
                @change=${({target}: {target: HTMLInputElement}) => {
                  this.showSecret = target.checked;
                }}
              >
                Show Password
              </vscode-checkbox>
            </div>`,
          () =>
            html`<div class="button-group">
              <vscode-button
                @click=${() => {
                  this.settingSecret = true;
                }}
              >
                ${this.secret ? 'Change' : 'Set'}
              </vscode-button>
              ${when(
                this.secret,
                () =>
                  html` <vscode-button
                    @click=${() => {
                      this.setSecret('');
                    }}
                  >
                    Clear
                  </vscode-button>`
              )}
            </div>`
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'secret-editor': SecretEditor;
  }
}

/*
 * Copyright 2024 Google LLC
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

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {copy} from '../assets/copy';
import '../components/popup_dialog';
import './download_form';

const styles = css`
  .copy-button {
    width: 25px;
    height: 25px;
    background-color: var(--vscode-editorWidget-background);
    color: var(--vscode-editorWidget-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    border-radius: 4px;
    cursor: pointer;
  }

  .copy-button svg {
    width: 25px;
    height: 25px;
  }
`;

@customElement('copy-button')
export class CopyButton extends LitElement {
  static override styles = [styles];

  @property()
  onCopy!: () => Promise<void>;

  override render() {
    return html`<div class="copy-button" @click=${this.onCopy}>${copy}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'copy-button': CopyButton;
  }
}

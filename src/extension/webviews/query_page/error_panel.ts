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
import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';

@customElement('error-panel')
export class ErrorPanel extends LitElement {
  @property() message?: string;

  static override styles = css`
    div {
      background-color: var(--vscode-inputValidation-errorBackground);
      padding: 10px;
      margin: 30px;
      border-radius: 4px;
      font-size: var(--vscode-editor-font-size);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      overflow: auto;
    }
  `;

  override render() {
    if (!this.message) {
      return html``;
    }
    const multiLine = this.message.indexOf('\n') ?? -1 >= 0;
    const multilineStyles = {
      'white-space': multiLine ? 'pre-wrap' : 'normal',
      'font-family': multiLine ? 'monospace' : 'inherit',
      'word-wrap': 'break-word',
    };
    const parts = this.message.split(/((?:http|https|vscode):\/\/\S*)\b/);
    const formatted = parts.map(part => {
      if (part.match(/^(http|https|vscode):/)) {
        return html`<a href="${part}">${part}</a>`;
      } else {
        return part;
      }
    });
    return html`<div style=${styleMap(multilineStyles)}>${formatted}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'error-panel': ErrorPanel;
  }
}

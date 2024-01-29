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
import {classMap} from 'lit/directives/class-map.js';

const styles = css`
  .popover {
    position: absolute;
    display: none;
    right: 10px;
    border: 1px solid var(--dropdown-border);
    box-shadow: rgba(0, 0, 0, 0.1) 0px 1px 5px 1px;
    background-color: var(--dropdown-background);
    color: var(--dropdown-foreground);
    font-size: var(--vscode-font-size);
    width: 200px;
    padding: 15px;
    flex-direction: column;

    &.open {
      display: flex;
      z-index: 101;
    }
  }

  .popover-content {
    display: flex;
    flex-direction: column;
  }
`;

@customElement('popup-dialog')
export class PopupDialog extends LitElement {
  static override styles = [styles];

  @property({type: Boolean})
  open!: boolean;

  override render() {
    return html`<div class=${classMap({popover: true, open: this.open})}>
      <div class="popover-content">
        <slot></slot>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'popup-dialog': PopupDialog;
  }
}

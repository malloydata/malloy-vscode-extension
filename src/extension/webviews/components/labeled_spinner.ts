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

import {spinner} from '../assets/spinner';

@customElement('labeled-spinner')
export class LabeledSpinner extends LitElement {
  @property() text?: string;

  static override styles = css`
    .vertical-center {
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex: 1 0 auto;
      width: 100%;
      height: 100%;
    }
    .horizontal-center {
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
    }
    .label {
      margin-bottom: 10px;
      color: var(--malloy-title-color, #505050);
      font-size: 15px;
    }
    .spinning-svg {
      width: 25px;
      height: 25px;
      animation: spin-anim 2s infinite linear;
    }

    @keyframes spin-anim {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(359deg);
      }
    }
  `;

  override render() {
    return html` <div class="vertical-center">
      <div class="horizontal-center">
        <div class="label">${this.text || ''}</div>
        <div class="spinning-svg">${spinner}</div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'labeled-spinner': LabeledSpinner;
  }
}

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
import {classMap} from 'lit/directives/class-map.js';

export enum ResultKind {
  HTML = 'html',
  JSON = 'json',
  METADATA = 'metadata',
  PREVIEW = 'preview',
  SQL = 'sql',
  SCHEMA = 'schema',
}

export const resultKindFromString = (kind?: string) => {
  switch (kind) {
    case 'html':
      return ResultKind.HTML;
    case 'json':
      return ResultKind.JSON;
    case 'metadata':
      return ResultKind.METADATA;
    case 'preview':
      return ResultKind.PREVIEW;
    case 'sql':
      return ResultKind.SQL;
    case 'schema':
      return ResultKind.SCHEMA;
  }

  return undefined;
};

@customElement('result-kind-toggle')
export class ResultKindToggle extends LitElement {
  @property({type: Array}) availableKinds: ResultKind[] = [];
  @property() resultKind = ResultKind.HTML;
  @property() setKind: (kind: ResultKind) => void = (_kind: ResultKind) => {};

  static override styles = css`
    .result-controls {
      display: flex;
      justify-content: end;
      padding: 5px 5px 3px 5px;
      font-size: 12px;
      gap: 3px;
      text-transform: uppercase;
    }
  `;

  localSetKind(kind: ResultKind) {
    this.resultKind = kind;
    this.setKind(kind);
  }

  override render() {
    return html`<div>
      <div class="result-controls">
        ${this.availableKinds.map(
          kind =>
            html`<result-control
              label=${kind}
              .selected=${this.resultKind === kind}
              @click=${() => this.localSetKind(kind)}
            >
            </result-control>`
        )}
      </div>
    </div>`;
  }
}

@customElement('result-control')
export class ResultControl extends LitElement {
  @property({type: Boolean}) selected = false;
  @property() label = '';

  static override styles = css`
    div {
      border: 0;
      border-bottom: none;
      cursor: pointer;
      padding: 3px 5px;
      color: var(--vscode-panelTitle-activeForeground);
    }
    .active {
      border-bottom: 1px solid var(--vscode-panelTitle-activeBorder);
    }
  `;

  override render() {
    const classes = classMap(this.selected ? {active: this.selected} : {});
    return html`<div class="${classes}">${this.label}</div>`;
  }
}

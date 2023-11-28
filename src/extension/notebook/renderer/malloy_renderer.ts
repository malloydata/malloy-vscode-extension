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

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {until} from 'lit/directives/until.js';
import {Result, ResultJSON} from '@malloydata/malloy';
import {HTMLView} from '@malloydata/render';
import {RenderDef} from '@malloydata/render/dist/data_styles';

const styles = css`
  :root {
    --malloy-font-family: var(--vscode-font-family, Roboto);
    --malloy-title-color: var(--vscode-titleBar-activeForeground);
    --malloy-label-color: var(--vscode-tab-activeForeground);
    --malloy-border-color: var(--vscode-notifications-border);
    --malloy-tile-background-color: var(--vscode-notifications-background);
  }
`;

@customElement('malloy-renderer')
export class MalloyRenderer extends LitElement {
  @property({type: Object}) postMessage?: (message: unknown) => void;
  static override styles = [styles];

  @property({type: Object}) results: ResultJSON | null = null;

  override render() {
    if (!this.results) {
      return;
    }
    const result = Result.fromJSON(this.results);
    const resultHtml = new HTMLView(document).render(result, {
      dataStyles: {},
      isDrillingEnabled: true,
      onDrill: (
        drillQuery: string,
        _target: HTMLElement,
        _drillFilters: string[]
      ) => {
        const command = 'malloy.copyToClipboard';
        const args = [drillQuery, 'Query'];
        this.postMessage?.({command, args});
      },
    });
    return html`${until(resultHtml)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'malloy-renderer': MalloyRenderer;
  }
}

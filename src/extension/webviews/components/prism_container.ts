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
// TODO(whscullin) Lens Query Panel
// import {safeHTML} from 'lit/directives/safe-html.js';
import * as prism from 'prismjs';
import {HtmlSanitizerBuilder} from 'safevalues';

// TODO(whscullin) Lens Query Panel
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-sql';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
const safeHTML = (trusted: TrustedHTML) => {
  return unsafeHTML(trusted.toString());
};

@customElement('prism-container')
export class PrismContainer extends LitElement {
  @property({type: Boolean}) darkMode = false;
  @property() code = '';
  @property() language?: string;

  static override styles = css`
    pre {
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      margin: 10px;
    }

    .dark > pre {
      color: #9cdcfe; //#333388;
    }
    .dark .keyword {
      color: #c586c0; //#af00db;
    }

    .dark .comment {
      color: #6a9955; //#4f984f;
    }

    .dark .function,
    .dark .function_keyword {
      color: #ce9178; //#795e26;
    }

    .dark .string {
      color: #d16969; //#ca4c4c;
    }

    .dark .regular_ex {
      color: #f03e91; //#88194d;
    }

    .dark .operator,
    .dark .punctuation {
      color: #dadada; //#505050;
    }

    .dark .punctuation {
      color: #dadada; //#505050;
    }

    .dark .number {
      color: #4ec9b0; //#09866a;
    }

    .dark .type,
    .dark .timeframe {
      color: #569cd6; //#0070c1;
    }

    .dark .date {
      color: #4ec9b0; //#09866a;
      /* color: #8730b3;//#8730b3;; */
    }

    .dark .property {
      color: #dcdcaa; //#b98f13;
    }

    .light > pre {
      color: #333388;
    }
    .light .keyword {
      color: #af00db;
    }

    .light .comment {
      color: #4f984f;
    }

    .light .function,
    .light .function_keyword {
      color: #795e26;
    }

    .light .string {
      color: #ca4c4c;
    }

    .light .regular_ex {
      color: #88194d;
    }

    .light .operator,
    .light .punctuation {
      color: #505050;
    }

    .light .punctuation {
      color: #505050;
    }

    .light .number {
      color: #09866a;
    }

    .light .type,
    .light .timeframe {
      color: #0070c1;
    }

    .light .date {
      color: #09866a;
      /* color: #8730b3;//#8730b3;; */
    }

    .light .property {
      color: #b98f13;
    }
  `;

  override render() {
    if (!this.language) {
      throw new Error('language is required to render code');
    }
    const sanitizer = new HtmlSanitizerBuilder().allowClassAttributes().build();
    const sanitizedCode = sanitizer.sanitize(
      prism.highlight(this.code, prism.languages[this.language], this.language)
    );

    const classes = classMap({dark: this.darkMode, light: !this.darkMode});
    return html`<div class=${classes}>
      <pre>${safeHTML(sanitizedCode)}</pre>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'prism-container': PrismContainer;
  }
}

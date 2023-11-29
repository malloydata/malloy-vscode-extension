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
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
} from '@vscode/webview-ui-toolkit';

provideVSCodeDesignSystem().register(vsCodeButton());

const helpPageStyles = css`
  :root {
    display: block;
  }

  .view {
    padding: 1em 20px 1em;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .help {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  button-link {
    width: 100%;
    max-width: 300px;
  }
`;

@customElement('help-page')
export class HelpPage extends LitElement {
  static override styles = [helpPageStyles];

  override render() {
    return html`<div class="view">
      <div class="help">
        <h3 id="about-malloy">About Malloy</h3>
        <p>
          Malloy is an open source language for describing data relationships
          and transformations. It is both a semantic modeling language and a
          querying language that runs queries against a relational database.
          Malloy currently supports BigQuery, Postgres, and DuckDB.
          <br />
          <br />
          The installed Visual Studio Code extension supports building Malloy
          data models, querying and transforming data, and creating simple
          visualizations and dashboards.
        </p>
      </div>
      <div class="help">
        <h3>Malloy Resources</h3>
      </div>

      <button-link
        href="https://docs.malloydata.dev/documentation/user_guides/basic.html"
      >
        Quick Start Guide
      </button-link>
      <button-link
        href="https://docs.malloydata.dev/documentation/language/sql_to_malloy.html"
      >
        Language Reference
      </button-link>
      <button-link
        href="https://github.com/malloydata/malloy-samples/archive/refs/heads/main.zip"
      >
        Download Sample Models
      </button-link>
      <button-link href="https://docs.malloydata.dev/documentation/index.html">
        View Documentation
      </button-link>
    </div>`;
  }
}

const buttonLinkStyles = css`
  :root {
    display: block;
    width: 100%;
  }

  a {
    text-decoration: none;
    width: 100%;
  }

  vscode-button {
    height: 26px;
    width: 100%;
  }
`;

@customElement('button-link')
export class ButtonLink extends LitElement {
  static override styles = [buttonLinkStyles];

  @property() href = '';

  override render() {
    return html`<a href=${this.href}>
      <vscode-button>
        <slot></slot>
      </vscode-button>
    </a>`;
  }
}

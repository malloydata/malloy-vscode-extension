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

import * as vscode from 'vscode';
import {v1 as uuid} from 'uuid';
import {Utils} from 'vscode-uri';

export function getWebviewHtml(
  extensionUri: vscode.Uri,
  module: string,
  webview: vscode.Webview
): string {
  const onDiskPath = Utils.joinPath(extensionUri, 'dist', `${module}.js`);
  const entrySrc = webview.asWebviewUri(onDiskPath);
  const cspSrc = webview.cspSource;
  const explorerCss = webview.asWebviewUri(
    vscode.Uri.joinPath(
      extensionUri,
      'node_modules',
      '@malloydata/malloy-explorer',
      'dist',
      'malloy-explorer.css'
    )
  );
  const monacoCss = webview.asWebviewUri(
    vscode.Uri.joinPath(
      extensionUri,
      'node_modules',
      'monaco-editor-core/min/vs/editor/editor.main.css'
    )
  );

  const nonce = getNonce();
  return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="base-uri 'none'; default-src blob:; style-src 'unsafe-inline' ${cspSrc} https://rsms.me/; font-src ${cspSrc} data: https://rsms.me/; img-src ${cspSrc} data: https:; script-src 'nonce-${nonce}' blob: 'unsafe-eval';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://rsms.me/" />
    <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
    <link rel="stylesheet" href="${explorerCss}" />
    <link rel="stylesheet" href="${monacoCss}" />
    <title>Malloy Results</title>
  <style>
    :root {
      --malloy-font-family: var(--vscode-font-family, Arial);
      --malloy-title-color: var(--vscode-titleBar-activeForeground);
      --malloy-label-color: var(--vscode-tab-activeForeground);
      --malloy-border-color: var(--vscode-notifications-border);
      --malloy-tile-background-color: var(--vscode-notifications-background);

      --malloy-composer-fontSize: var(--vscode-font-size);
      --malloy-composer-fontFamily: var(--vscode-font-family, Arial);
      --malloy-composer-background: var(--vscode-editor-background);
      --malloy-composer-foreground: var(--vscode-editor-foreground);

      --malloy-composer-ruler: var(--vscode-editorWidget-border);

      --malloy-composer-header-background: var(--vscode-notifications-background);

      --malloy-composer-code-fontSize: var(--vscode-editor-font-size);
      --malloy-composer-code-fontFamily: var(--vscode-editor-font-family, monospace);

      --malloy-composer-form-background: var(--vscode-editorWidget-background);
      --malloy-composer-form-foreground:  var(--vscode-editorWidget-foreground);
      --malloy-composer-form-border: var(--vscode-editorWidget-border)
      --malloy-composer-form-fontFamily: var(--vscode-font-family, Arial);
      --malloy-composer-form-fontSize: var(--vscode-font-size);
      --malloy-composer-form-focus: var(--vscode-focusBorder);
      --malloy-composer-form-focusBackground: var(--vscode-list-hoverBackground);

      --malloy-composer-menu-background: var(--vscode-menu-background);
      --malloy-composer-menu-foreground: var(--vscode-menu-foreground);
      --malloy-composer-menu-border: var(--vscode-menu-border);
      --malloy-composer-menu-title: var(--vscode-menu-foreground);
      --malloy-composer-menu-fontFamily: var(--vscode-menu-font);
      --malloy-composer-menu-fontSize: var(--vscode-font-size);
    }
    .shiki span {
      font-size: var(--vscode-editor-font-size);
      font-family: var(--vscode-editor-font-family);
    }
    .shiki, .shiki code {
      background-color: var(--vscode-editor-background) !important;
    }
    html,body,#app {
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      font-family: var(--malloy-font-family);
    }
    body {
      background-color: transparent;
    }
    .placeholder-vertical-center {
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex: 1 0 auto;
      width: 100%;
      height: 100%;
    }
    .placeholder-horizontal-center {
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
    }
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(359deg);
      }
    }
    .placeholder-spinning-svg {
      width: 25px;
      height: 25px;
      animation: spin 2s infinite linear;
    }
    .placeholder-label {
      margin-bottom: 10px;
      color: var(--malloy-title-color, #505050);
      font-size: 15px;
    }
  </style>
  </head>
  <body>
    <div id="app">
      <div class="placeholder-vertical-center">
        <div class="placeholder-horizontal-center">
          <div class="placeholder-label">Loading</div>
          <div class="placeholder-spinning-svg">
            <svg width="25px" height="25px" viewBox="0 0 15 15" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
              <title>malloy-icon-status-progress</title>
              <defs>
                  <circle id="path-1" cx="7.5" cy="7.5" r="7.5"></circle>
                  <mask id="mask-2" maskContentUnits="userSpaceOnUse" maskUnits="objectBoundingBox" x="0" y="0" width="15" height="15" fill="white">
                      <use xlink:href="#path-1"></use>
                  </mask>
              </defs>
              <g id="malloy-icon-status-progress" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-dasharray="16">
                  <use id="Oval-Copy-3" stroke="#1a73e8" mask="url(#mask-2)" stroke-width="3" transform="translate(7.500000, 7.500000) rotate(-240.000000) translate(-7.500000, -7.500000) " xlink:href="#path-1"></use>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </body>
  <script nonce="${nonce}" src="${entrySrc}"></script>
</html>`;
}

function getNonce() {
  return uuid();
}

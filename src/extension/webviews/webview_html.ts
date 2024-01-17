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
import {MALLOY_EXTENSION_STATE} from '../state';
import {Utils} from 'vscode-uri';

export function getWebviewHtml(
  module: string,
  webview: vscode.Webview
): string {
  const onDiskPath = Utils.joinPath(
    MALLOY_EXTENSION_STATE.getExtensionUri(),
    'dist',
    `${module}.js`
  );
  const entrySrc = webview.asWebviewUri(onDiskPath);
  const cspSrc = webview.cspSource;

  const nonce = getNonce();
  return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="base-uri 'none'; default-src blob:; style-src 'unsafe-inline' ${cspSrc} https://rsms.me/; font-src ${cspSrc} https://rsms.me/; img-src ${cspSrc} https:; script-src 'nonce-${nonce}' 'unsafe-eval';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://rsms.me/" />
    <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
    <title>Malloy Results</title>
  </head>
  <style>
    :root {
      --malloy-font-family: var(--vscode-font-family, Roboto);
      --malloy-title-color: var(--vscode-titleBar-activeForeground);
      --malloy-label-color: var(--vscode-tab-activeForeground);
      --malloy-border-color: var(--vscode-notifications-border);
      --malloy-tile-background-color: var(--vscode-notifications-background);
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

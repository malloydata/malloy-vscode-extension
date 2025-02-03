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

import * as React from 'react';
import {Result} from '@malloydata/malloy';
import {HTMLView} from '@malloydata/render';
import '@malloydata/render/webcomponent';
import {MalloyRendererMessage} from '../types';
import {useEffect, useState} from 'react';
import {DOMElement} from '../../webviews/components/DOMElement';

export interface MalloyRendererProps {
  postMessage?: (message: MalloyRendererMessage) => void;
  result: Result | null;
}

const css = `
  malloy-render::part(container) {
    max-height: 600px;
  }
  :root {
    --malloy-font-family: var(--vscode-font-family, Roboto);
    --malloy-title-color: var(--vscode-titleBar-activeForeground);
    --malloy-label-color: var(--vscode-tab-activeForeground);
    --malloy-border-color: var(--vscode-notifications-border);
    --malloy-tile-background-color: var(--vscode-notifications-background);
  }
`;

export const MalloyRenderer = ({postMessage, result}: MalloyRendererProps) => {
  const [resultHtml, setResultHtml] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (result) {
      new HTMLView(document)
        .render(result, {
          dataStyles: {},
          isDrillingEnabled: true,
          onDrill: (
            drillQuery: string,
            _target: HTMLElement,
            _drillFilters: string[]
          ) => {
            const command = 'malloy.copyToClipboard';
            const args = [drillQuery, 'Query'];
            postMessage?.({command, args});
          },
          nextRendererOptions: {
            tableConfig: {
              enableDrill: true,
            },
          },
        })
        .then(resultHtml => setResultHtml(resultHtml));
    }
  }, [postMessage, result]);

  return (
    <>
      <link rel="preconnect" href="https://rsms.me/" />
      <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      <style>{css}</style>
      {resultHtml ? <DOMElement element={resultHtml} /> : null}
    </>
  );
};

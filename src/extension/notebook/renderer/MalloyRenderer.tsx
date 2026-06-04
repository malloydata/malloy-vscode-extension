/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as React from 'react';
import {API, Result} from '@malloydata/malloy';
import {HTMLView} from '@malloydata/render';
import {MalloyRendererMessage} from '../types';
import {useEffect, useState} from 'react';
import {DOMElement} from '../../webviews/components/DOMElement';

export interface MalloyRendererProps {
  postMessage?: (message: MalloyRendererMessage) => void;
  result: Result | null;
}

const css = /* css */ `
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
      const malloyResult = API.util.wrapResult(result);
      void new HTMLView(document)
        .render(malloyResult, {
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

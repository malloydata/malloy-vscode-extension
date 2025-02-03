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
import {createRoot} from 'react-dom/client';
import {ActivationFunction} from 'vscode-notebook-renderer';
import './MalloyRenderer';
import '@malloydata/render/webcomponent';
import {Result} from '@malloydata/malloy';
import {MalloyRenderProps} from '@malloydata/render';
import {StyleSheetManager} from 'styled-components';
import {SchemaRendererWrapper} from './schema_entry';

// TODO: Figure out how to make this part of @malloydata/render/webcomponent export
declare global {
  interface HTMLElementTagNameMap {
    'malloy-render': HTMLElement & MalloyRenderProps;
  }
}

export const activate: ActivationFunction = ({postMessage}) => {
  return {
    renderOutputItem(info, element) {
      const result = Result.fromJSON(info.json());
      const isNextRenderer = !result.modelTag.has('renderer_legacy');
      if (isNextRenderer) {
        const root = element;
        const parent = document.createElement('div');
        parent.style.maxHeight = '400px';
        parent.style.border = '1px solid #e5e7eb';
        parent.style.overflow = 'auto';

        const malloyRender = document.createElement('malloy-render');
        malloyRender.result = result;
        malloyRender.scrollEl = parent;
        malloyRender.tableConfig = {
          enableDrill: true,
        };
        malloyRender.onDrill = drillData => {
          const command = 'malloy.copyToClipboard';
          const args = [drillData.query, 'Query'];
          postMessage?.({command, args});
        };
        const style = document.createElement('style');
        style.innerHTML = `
          malloy-render::part(table-container) {
            overflow: visible;
          }
        `;
        parent.appendChild(malloyRender);
        parent.appendChild(style);
        root.replaceChildren(parent);
      } else {
        let shadow = element.shadowRoot;
        if (!shadow) {
          shadow = element.attachShadow({mode: 'open'});
          const root = document.createElement('div');
          root.id = 'root';
          shadow.append(root);
        }
        const root = shadow.querySelector<HTMLElement>('#root');
        if (!root) {
          throw new Error('Element #root not found');
        }
        const styledRoot = document.createElement('div');
        styledRoot.id = 'styled-root';
        root.id = 'root';
        styledRoot.append(root);
        const reactRoot = createRoot(root);
        reactRoot.render(
          <StyleSheetManager target={styledRoot}>
            <SchemaRendererWrapper
              results={info.json()}
              postMessage={postMessage}
            />
          </StyleSheetManager>
        );
      }
    },
  };
};

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
import {API, Result} from '@malloydata/malloy';
import {DrillData, MalloyRenderer} from '@malloydata/render';
import {StyleSheetManager} from 'styled-components';
import {SchemaRendererWrapper} from './schema_entry';

export const activate: ActivationFunction = ({postMessage}) => {
  return {
    renderOutputItem(info, element) {
      const result = Result.fromJSON(info.json());
      const isNextRenderer = !result.modelTag.has('renderer_legacy');
      if (isNextRenderer) {
        const root = element;
        const parent = document.createElement('div');
        parent.style.maxHeight = '400px';
        parent.style.minHeight = '200px';
        parent.style.border = '1px solid #e5e7eb';
        parent.style.overflow = 'auto';
        parent.style.display = 'grid';

        const style = document.createElement('style');
        // Align top table border with cell border
        // Prevent table from overflowing since cell handles overflow
        style.innerHTML = `
          .malloy-render > .malloy-table.root {
            transform: translateY(-1px);
            overflow: hidden;
          }
        `;
        root.replaceChildren(style);
        root.appendChild(parent);

        const renderer = new MalloyRenderer({});
        const viz = renderer.createViz({
          tableConfig: {
            enableDrill: true,
          },
          onDrill: ({query}: DrillData) => {
            const command = 'malloy.copyToClipboard';
            const args = [query, 'Query'];
            postMessage?.({command, args});
          },
          scrollEl: parent,
        });
        const malloyResult = API.util.wrapResult(result);
        viz.setResult(malloyResult);
        viz.render(parent);
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

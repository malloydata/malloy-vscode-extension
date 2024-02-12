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

import {html, render} from 'lit';
import {ActivationFunction} from 'vscode-notebook-renderer';
import './malloy_renderer';
import {Result} from '@malloydata/malloy';

export const activate: ActivationFunction = ({postMessage}) => {
  let shadow: ShadowRoot | null = null;
  const mousewheelHandler = (evt: WheelEvent) => {
    const tableScrollState = shadow
      ?.querySelector('malloy-renderer')
      ?.getMalloyRender()
      ?.getTableScrollState?.();
    const blockScrollUp = evt.deltaY < 0 && !tableScrollState?.isAtTop;
    const blockScrollDown = evt.deltaY > 0 && !tableScrollState?.isAtBottom;
    if (blockScrollUp || blockScrollDown) {
      evt.stopPropagation();
    }
  };

  return {
    renderOutputItem(info, element) {
      shadow = element.shadowRoot;
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
      const result = Result.fromJSON(info.json());
      if (result.resultExplore.modelTag.has('renderer_next')) {
        root.style.border = '1px solid #e5e7eb';
        root.style.padding = '10px';
        root.addEventListener('wheel', mousewheelHandler);
      } else {
        root.style.border = '';
        root.style.padding = '';
        root.removeEventListener('wheel', mousewheelHandler);
      }
      render(
        html`<malloy-renderer
          .result=${result}
          .postMessage=${postMessage}
        ></malloy-renderer>`,
        root
      );
    },
  };
};

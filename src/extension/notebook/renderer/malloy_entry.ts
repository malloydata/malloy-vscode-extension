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

const mousewheelHandler = (evt: Event) => {
  evt.stopPropagation();
};

export const activate: ActivationFunction = () => {
  return {
    renderOutputItem(info, element) {
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
      const result = Result.fromJSON(info.json());
      if (result.resultExplore.modelTag.has('renderer_next')) {
        root.style.border = '1px solid #e5e7eb';
        root.style.padding = '10px';
        root.addEventListener('mousewheel', mousewheelHandler);
      } else {
        root.style.border = '';
        root.style.padding = '';
        root.removeEventListener('mousewheel', mousewheelHandler);
      }
      render(html`<malloy-renderer .results=${info.json()} />`, root);
    },
  };
};

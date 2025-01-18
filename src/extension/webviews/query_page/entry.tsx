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
import {html, render} from 'lit';
import {createRoot} from 'react-dom/client';
import {QueryPanelMessage} from '../../../common/types/message_types';

import './query_page';
import {getVSCodeAPI} from './query_vscode_context';
import {QueryPage} from './QueryPage';

const root = document.getElementById('app');

const useLit = root?.dataset['useNewQueryPage'] !== 'true';

if (root) {
  const vscode = getVSCodeAPI<QueryPanelMessage, void>();
  root.innerText = '';
  if (useLit) {
    render(html`<query-page .vscode=${vscode}></query-page>`, root);
  } else {
    const reactRoot = createRoot(root);
    reactRoot.render(<QueryPage vscode={vscode} />);
  }
}

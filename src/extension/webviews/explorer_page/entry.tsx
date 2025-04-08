/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {getVSCodeAPI} from '../vscode_wrapper';
import {App} from './App';
import {ComposerPageMessage} from '../../../common/types/message_types';

const root = document.getElementById('app');

if (root) {
  const vscode = getVSCodeAPI<ComposerPageMessage, void>();
  root.innerText = '';
  const reactRoot = createRoot(root);
  reactRoot.render(<App vscode={vscode} />);
}

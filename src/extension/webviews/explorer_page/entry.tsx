/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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

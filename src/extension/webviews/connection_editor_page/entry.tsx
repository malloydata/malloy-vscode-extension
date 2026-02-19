/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {SingleConnectionMessage} from '../../../common/types/message_types';
import {getVSCodeAPI} from '../vscode_wrapper';
import {ConnectionEditorApp} from './ConnectionEditorApp';

const root = document.getElementById('app');

if (root) {
  const vscode = getVSCodeAPI<SingleConnectionMessage, void>();
  root.innerText = '';
  const reactRoot = createRoot(root);
  reactRoot.render(<ConnectionEditorApp vscode={vscode} />);
}

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryPanelMessage} from '../../../common/types/message_types';

import {getVSCodeAPI} from './query_vscode_context';
import {QueryPage} from './QueryPage';

const root = document.getElementById('app');

if (root) {
  const vscode = getVSCodeAPI<QueryPanelMessage, void>();
  root.innerText = '';
  const reactRoot = createRoot(root);
  reactRoot.render(<QueryPage vscode={vscode} />);
}

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {HelpPage} from './HelpPage';

const root = document.getElementById('app');

if (root) {
  root.innerText = '';
  const reactRoot = createRoot(root);
  reactRoot.render(<HelpPage />);
}

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';

/**
 * Centralized place to pull configuration for Malloy extension
 *
 * @returns Malloy config (vscode.WorkspaceConfiguration)
 */
export const getMalloyConfig = (): vscode.WorkspaceConfiguration => {
  return vscode.workspace.getConfiguration('malloy');
};

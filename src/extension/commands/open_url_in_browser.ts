/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';

export function openUrlInBrowser(url: string): void {
  void vscode.env.openExternal(vscode.Uri.parse(url));
}

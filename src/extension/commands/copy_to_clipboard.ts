/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';

export async function copyToClipboardCommand(
  val: string,
  type: string
): Promise<void> {
  await vscode.env.clipboard.writeText(val);
  await vscode.window.showInformationMessage(`${type} copied to clipboard`);
}

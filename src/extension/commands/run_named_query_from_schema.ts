/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';

export async function runNamedQueryFromSchemaCommand(item: {
  name: string;
}): Promise<void> {
  return vscode.commands.executeCommand('malloy.runNamedQuery', item.name);
}

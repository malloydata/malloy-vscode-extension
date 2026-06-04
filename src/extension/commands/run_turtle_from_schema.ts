/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';

export function runTurtleFromSchemaCommand(item: {
  topLevelExplore: string;
  accessPath: string[];
}): Thenable<void> {
  return vscode.commands.executeCommand(
    'malloy.runQuery',
    `run: ${item.topLevelExplore}->${item.accessPath.join('.')}`,
    `${item.topLevelExplore}->${item.accessPath.join('.')}`
  );
}

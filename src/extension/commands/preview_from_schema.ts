/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';

export function previewFromSchemaCommand(item: {
  topLevelExplore: string;
  accessPath: string[];
}): Thenable<void> {
  return vscode.commands.executeCommand(
    'malloy.runQuery',
    `run: ${item.topLevelExplore}->{ select: ${[...item.accessPath, '*'].join(
      '.'
    )}; limit: 20 }`,
    `Preview: ${item.topLevelExplore} ${item.accessPath.join('.')}`,
    'preview'
  );
}

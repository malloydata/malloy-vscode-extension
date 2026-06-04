/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import {DocumentLocation} from '@malloydata/malloy';

export async function goToDefinitionFromSchemaCommand(item: {
  location?: DocumentLocation;
}): Promise<void> {
  const location = item.location;
  if (location) {
    const pos = new vscode.Position(
      location.range.start.line,
      location.range.start.character
    );
    const uri = vscode.Uri.parse(location.url);
    return vscode.commands.executeCommand(
      'editor.action.goToLocations',
      uri,
      pos,
      []
    );
  }
  return undefined;
}

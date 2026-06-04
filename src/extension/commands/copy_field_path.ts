/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import {FieldItem} from '../tree_views/schema_view';
import {quoteIfNecessary} from '../../common/schema';

export async function copyFieldPathCommand(item: FieldItem): Promise<void> {
  const fieldPath = item.accessPath.map(quoteIfNecessary).join('.');
  await vscode.env.clipboard.writeText(fieldPath);
  await vscode.window.showInformationMessage(
    `Copied '${fieldPath}' to clipboard`
  );
}

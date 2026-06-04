/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import {Utils} from 'vscode-uri';

export async function showLicensesCommand(
  context: vscode.ExtensionContext
): Promise<void> {
  const licenseFilePath = Utils.joinPath(
    context.extensionUri,
    'dist',
    'third_party_notices.txt'
  );

  const buffer = await vscode.workspace.fs.readFile(licenseFilePath);
  const content = new TextDecoder('utf-8').decode(buffer);
  const document = await vscode.workspace.openTextDocument({
    language: 'text',
    content: content.toString(),
  });

  await vscode.window.showTextDocument(document, {preview: true});
}

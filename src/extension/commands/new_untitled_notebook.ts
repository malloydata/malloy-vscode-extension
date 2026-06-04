/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';

const NOTEBOOK_TYPE = 'malloy-notebook';

export async function newUntitledNotebookCommand(): Promise<void> {
  const language = 'malloy';
  const defaultValue = '// Enter Malloy here';
  const cell = new vscode.NotebookCellData(
    vscode.NotebookCellKind.Code,
    defaultValue,
    language
  );
  const data = new vscode.NotebookData([cell]);
  data.metadata = {
    custom: {
      cells: [],
    },
  };
  const doc = await vscode.workspace.openNotebookDocument(NOTEBOOK_TYPE, data);
  await vscode.window.showNotebookDocument(doc);
}

/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as vscode from 'vscode';

const updateRenderer = (renderer: string): void => {
  const editor = vscode.window.activeNotebookEditor;
  const {notebook, selection} = editor;
  const {metadata} = notebook.cellAt(selection.start);
  const newMetadata = {...metadata} ?? {};
  newMetadata['renderer'] = renderer;
  const edit = new vscode.WorkspaceEdit();
  const notebookEdit = vscode.NotebookEdit.updateCellMetadata(
    selection.start,
    newMetadata
  );
  edit.set(notebook.uri, [notebookEdit]);
  vscode.workspace.applyEdit(edit);
};

function rendererTable(): void {
  updateRenderer('table');
}
function rendererList(): void {
  updateRenderer('list');
}
function rendererBarChart(): void {
  updateRenderer('bar_chart');
}
function rendererLineChart(): void {
  updateRenderer('line_chart');
}
function rendererScatterChart(): void {
  updateRenderer('scatter_chart');
}
function rendererShapeMap(): void {
  updateRenderer('shape_map');
}
function rendererPointMap(): void {
  updateRenderer('point_map');
}
function rendererSegmentMap(): void {
  updateRenderer('segment_map');
}
function rendererJson(): void {
  updateRenderer('json');
}
function rendererDashboard(): void {
  updateRenderer('dashboard');
}

export function registerRendererCommands(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('malloy.rendererTable', rendererTable)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('malloy.rendererList', rendererList)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('malloy.rendererBarChart', rendererBarChart)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.rendererLineChart',
      rendererLineChart
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.rendererScatterChart',
      rendererScatterChart
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('malloy.rendererShapeMap', rendererShapeMap)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('malloy.rendererPointMap', rendererPointMap)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.rendererSegmentMap',
      rendererSegmentMap
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('malloy.rendererJson', rendererJson)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.rendererDashboard',
      rendererDashboard
    )
  );
}

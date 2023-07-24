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
import {newUntitledNotebookCommand} from '../commands/new_untitled_notebook';
import {runMalloyQuery} from '../commands/run_query_utils';
import {WorkerConnection} from '../worker_connection';
import {errorMessage} from '../../common/errors';

const NO_QUERY = 'Model has no queries.';

export function activateNotebookController(
  context: vscode.ExtensionContext,
  worker: WorkerConnection
) {
  if (!vscode.notebooks) {
    return;
  }
  context.subscriptions.push(new MalloyController(worker));

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.newUntitledNotebook',
      newUntitledNotebookCommand
    )
  );
}

class MalloyController {
  readonly controllerId = 'malloy-notebook-controller';
  readonly notebookType = 'malloy-notebook';
  readonly label = 'Malloy Notebook';
  readonly supportedLanguages = ['malloy'];

  private readonly _controller: vscode.NotebookController;
  private _executionOrder = 0;

  constructor(private worker: WorkerConnection) {
    this._controller = vscode.notebooks.createNotebookController(
      this.controllerId,
      this.notebookType,
      this.label
    );

    this._controller.supportedLanguages = this.supportedLanguages;
    this._controller.supportsExecutionOrder = true;
    this._controller.executeHandler = this._execute.bind(this);
  }

  private _execute(
    cells: vscode.NotebookCell[],
    notebook: vscode.NotebookDocument,
    _controller: vscode.NotebookController
  ): void {
    for (const cell of cells) {
      this._doExecution(notebook, cell);
    }
  }

  private async _doExecution(
    _notebook: vscode.NotebookDocument,
    cell: vscode.NotebookCell
  ): Promise<void> {
    const execution = this._controller.createNotebookCellExecution(cell);
    execution.executionOrder = ++this._executionOrder;
    execution.start(Date.now());

    try {
      const jsonResults = await runMalloyQuery(
        this.worker,
        {type: 'file', index: -1, file: cell.document},
        cell.document.uri.toString(),
        cell.document.fileName.split('/').pop() || cell.document.fileName,
        {withWebview: false}
      );

      const text = cell.document.getText();
      let meta = cell.metadata ? {...cell.metadata} : {};
      const style = text.match(/\/\/ --! style ([a-z_]+)/m);
      if (style) {
        meta = {renderer: style[1]};
      }
      const output: vscode.NotebookCellOutput[] = [];
      if (jsonResults) {
        output.push(
          new vscode.NotebookCellOutput(
            [
              vscode.NotebookCellOutputItem.json(
                jsonResults,
                'x-application/malloy-results'
              ),
              vscode.NotebookCellOutputItem.json(
                jsonResults.queryResult.result
              ),
            ],
            meta
          )
        );
      }

      execution.replaceOutput(output);
      execution.end(true, Date.now());
    } catch (error) {
      execution.replaceOutput([
        new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.text(errorMessage(error)),
        ]),
      ]);
      execution.end(errorMessage(error) === NO_QUERY, Date.now());
    }
  }

  dispose() {
    // TODO
  }
}

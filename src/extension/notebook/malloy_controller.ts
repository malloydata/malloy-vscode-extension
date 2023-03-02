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
import {Runtime, URLReader} from '@malloydata/malloy';
import {ConnectionManager} from '../../common/connection_manager';
import {newUntitledNotebookCommand} from '../commands/new_untitled_notebook';

const NO_QUERY = 'Model has no queries.';

export function activateNotebookController(
  context: vscode.ExtensionContext,
  connectionManager: ConnectionManager,
  urlReader: URLReader
) {
  context.subscriptions.push(
    new MalloyController(connectionManager, urlReader)
  );

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

  constructor(
    private connectionManager: ConnectionManager,
    private urlReader: URLReader
  ) {
    if (!vscode.notebooks) {
      return;
    }
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
    _notebook: vscode.NotebookDocument,
    _controller: vscode.NotebookController
  ): void {
    for (const cell of cells) {
      this._doExecution(cell);
    }
  }

  private async _doExecution(cell: vscode.NotebookCell): Promise<void> {
    const execution = this._controller.createNotebookCellExecution(cell);
    execution.executionOrder = ++this._executionOrder;
    execution.start(Date.now());

    const url = new URL(cell.document.uri.toString());

    try {
      const runtime = new Runtime(
        this.urlReader,
        this.connectionManager.getConnectionLookup(url)
      );
      const query = runtime.loadQuery(url);
      const results = await query.run();
      execution.replaceOutput([
        new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.json(
            results.toJSON(),
            'x-application/malloy-results'
          ),
        ]),
      ]);
      execution.end(true, Date.now());
    } catch (error) {
      execution.replaceOutput([
        new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.text(error.message),
        ]),
      ]);
      execution.end(error.message === NO_QUERY, Date.now());
    }
  }

  dispose() {
    // TODO
  }
}

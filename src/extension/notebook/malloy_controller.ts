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
import {
  getDocumentMetadata,
  runMalloyQuery,
} from '../commands/utils/run_query_utils';
import {WorkerConnection} from '../worker_connection';
import {errorMessage} from '../../common/errors';
import {
  BuildModelRequest,
  CellMetadata,
  QueryCost,
} from '../../common/types/file_handler';
import {convertFromBytes} from '../../common/convert_to_bytes';
import {BaseLanguageClient} from 'vscode-languageclient';
import {FetchModelMessage} from '../../common/types/message_types';
import {noAwait} from '../../util/no_await';
import {MalloyRendererMessage} from './types';

const NO_QUERY = 'Model has no queries.';

interface MessageEvent {
  readonly editor: vscode.NotebookEditor;
  readonly message: MalloyRendererMessage;
}

function getQueryCostStats({queryCostBytes, isEstimate}: QueryCost): string {
  if (queryCostBytes === 0) {
    return 'Cached';
  }

  return `${isEstimate ? 'Will process' : 'Processed'} ${convertFromBytes(
    queryCostBytes
  )}`;
}

class MalloyNotebookCellStatusBarItem extends vscode.NotebookCellStatusBarItem {}

class MalloyNotebookCellStatusBarItemProvider
  implements vscode.NotebookCellStatusBarItemProvider
{
  _onDidChangeCellStatusBarItems = new vscode.EventEmitter<void>();

  provideCellStatusBarItems(
    cell: vscode.NotebookCell,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<
    vscode.NotebookCellStatusBarItem | vscode.NotebookCellStatusBarItem[]
  > {
    const results: vscode.NotebookCellStatusBarItem[] = [];
    const metadata = cell.metadata as CellMetadata;
    const cost = metadata.cost;
    if (cost) {
      results.push(
        new MalloyNotebookCellStatusBarItem(
          getQueryCostStats(cost),
          vscode.NotebookCellStatusBarAlignment.Left
        )
      );
    }
    return results;
  }

  get onDidChangeCellStatusBarItems() {
    return this._onDidChangeCellStatusBarItems.event;
  }

  dispose() {
    this._onDidChangeCellStatusBarItems.dispose();
  }

  update() {
    this._onDidChangeCellStatusBarItems.fire();
  }
}

export function activateNotebookController(
  context: vscode.ExtensionContext,
  client: BaseLanguageClient,
  worker: WorkerConnection
) {
  if (!vscode.notebooks) {
    return;
  }

  const statusBarProvider = new MalloyNotebookCellStatusBarItemProvider();
  context.subscriptions.push(
    vscode.notebooks.registerNotebookCellStatusBarItemProvider(
      'malloy-notebook',
      statusBarProvider
    )
  );

  context.subscriptions.push(
    new MalloyController(worker, client, statusBarProvider)
  );

  const relayEvent = (event: MessageEvent) => {
    const {command, args} = event.message;
    vscode.commands.executeCommand(command, ...args);
  };
  context.subscriptions.push(
    vscode.notebooks
      .createRendererMessaging('malloy.notebook-renderer')
      .onDidReceiveMessage(relayEvent)
  );
  context.subscriptions.push(
    vscode.notebooks
      .createRendererMessaging('malloy.notebook-renderer-schema')
      .onDidReceiveMessage(relayEvent)
  );
}

class MalloyController {
  readonly controllerId = 'malloy-notebook-controller';
  readonly notebookType = 'malloy-notebook';
  readonly label = 'Malloy Notebook';
  readonly supportedLanguages = ['malloy', 'malloy-sql'];

  private readonly _controller: vscode.NotebookController;
  private _executionOrder = 0;

  constructor(
    private worker: WorkerConnection,
    private client: BaseLanguageClient,
    private statusBarProvider: MalloyNotebookCellStatusBarItemProvider
  ) {
    this._controller = vscode.notebooks.createNotebookController(
      this.controllerId,
      this.notebookType,
      this.label
    );

    this._controller.supportedLanguages = this.supportedLanguages;
    this._controller.supportsExecutionOrder = true;
    this._controller.executeHandler = this._execute.bind(this);
  }

  private async _execute(
    cells: vscode.NotebookCell[],
    notebook: vscode.NotebookDocument,
    _controller: vscode.NotebookController
  ): Promise<void> {
    for (const cell of cells) {
      await this._doExecution(notebook, cell);
    }
  }

  private async _doExecution(
    _notebook: vscode.NotebookDocument,
    cell: vscode.NotebookCell
  ): Promise<void> {
    const {document} = cell;
    const uri = document.uri.toString();
    const execution = this._controller.createNotebookCellExecution(cell);
    execution.executionOrder = ++this._executionOrder;
    execution.start(Date.now());

    try {
      const meta = cell.metadata ? {...cell.metadata} : {};
      const newMeta: CellMetadata = {
        ...meta,
        cost: undefined,
      };
      const edits: vscode.NotebookEdit[] = [
        vscode.NotebookEdit.updateCellMetadata(cell.index, newMeta),
      ];
      const edit = new vscode.WorkspaceEdit();
      edit.set(document.uri, edits);
      noAwait(vscode.workspace.applyEdit(edit));
      this.statusBarProvider.update();

      const documentMeta = getDocumentMetadata(document);
      const jsonResults = await runMalloyQuery(
        this.worker,
        {type: 'file', index: -1, documentMeta},
        uri,
        document.fileName.split('/').pop() || document.fileName,
        {withWebview: false},
        execution.token
      );

      const output: vscode.NotebookCellOutput[] = [];
      if (jsonResults) {
        const items: vscode.NotebookCellOutputItem[] = [];
        if (jsonResults.queryResult.structs.length) {
          items.push(
            vscode.NotebookCellOutputItem.json(
              jsonResults,
              'x-application/malloy-results'
            )
          );
        }
        items.push(
          vscode.NotebookCellOutputItem.json(jsonResults.queryResult.result)
        );
        items.push(
          vscode.NotebookCellOutputItem.text(
            jsonResults.queryResult.sql,
            'text/x-sql'
          )
        );
        output.push(new vscode.NotebookCellOutput(items, meta));

        const queryCostBytes = jsonResults.queryResult.runStats?.queryCostBytes;
        if (typeof queryCostBytes === 'number') {
          const newMeta: CellMetadata = {
            ...meta,
            cost: {queryCostBytes, isEstimate: false},
          };
          const edits: vscode.NotebookEdit[] = [
            vscode.NotebookEdit.updateCellMetadata(cell.index, newMeta),
          ];
          const edit = new vscode.WorkspaceEdit();
          edit.set(document.uri, edits);
          noAwait(vscode.workspace.applyEdit(edit));
          this.statusBarProvider.update();
        }
      }

      noAwait(execution.replaceOutput(output));
      execution.end(true, Date.now());
    } catch (error) {
      if (errorMessage(error) === NO_QUERY) {
        const request: BuildModelRequest = {
          uri: document.uri.toString(),
          version: document.version,
          languageId: document.languageId,
          refreshSchemaCache: false,
        };
        noAwait(
          execution.replaceOutput([
            new vscode.NotebookCellOutput([
              vscode.NotebookCellOutputItem.text('Loading Schema Information'),
            ]),
          ])
        );
        const model: FetchModelMessage = await this.client.sendRequest(
          'malloy/fetchModel',
          request
        );
        noAwait(
          execution.replaceOutput([
            new vscode.NotebookCellOutput([
              vscode.NotebookCellOutputItem.json(
                model,
                'x-application/malloy-schema'
              ),
            ]),
          ])
        );
        execution.end(true, Date.now());
      } else {
        noAwait(
          execution.replaceOutput([
            new vscode.NotebookCellOutput([
              vscode.NotebookCellOutputItem.text(errorMessage(error)),
            ]),
          ])
        );
        execution.end(false, Date.now());
      }
    }
  }

  dispose() {
    // TODO
  }
}

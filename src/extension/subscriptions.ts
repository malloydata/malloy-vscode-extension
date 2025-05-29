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
import * as Malloy from '@malloydata/malloy-interfaces';
import {SchemaProvider} from './tree_views/schema_view';
import {
  copyFieldPathCommand,
  copyToClipboardCommand,
  goToDefinitionFromSchemaCommand,
  newUntitledNotebookCommand,
  openUrlInBrowser,
  previewFromSchemaCommand,
  runNamedQuery,
  runNamedQueryFromSchemaCommand,
  runQueryCommand,
  runQueryFileCommand,
  runTurtleFromSchemaCommand,
  showLicensesCommand,
  showSQLCommand,
  showSQLFileCommand,
  showSQLNamedQueryCommand,
} from './commands';
import {malloyLog} from './logger';
import {trackModelLoad, trackModelSave} from './telemetry';
import {HelpViewProvider} from './webviews/help_view';
import {v4 as uuid} from 'uuid';

import {MALLOY_EXTENSION_STATE} from './state';
import {activateNotebookSerializer} from './notebook/malloy_serializer';
import {activateNotebookController} from './notebook/malloy_controller';
import {
  FetchBinaryFileEvent,
  FetchCellDataEvent,
  FetchFileEvent,
  FileHandler,
} from '../common/types/file_handler';
import {
  GenericConnection,
  WorkerFetchMessage,
  WorkerGetSecretMessage,
} from '../common/types/worker_message_types';
import {BaseLanguageClient} from 'vscode-languageclient';
import {WorkerConnection} from './worker_connection';
import {runQueryAtCursorCommand} from './commands/run_query_at_cursor';
import {showSchemaFileCommand} from './commands/show_schema_file';
import {noAwait} from '../util/no_await';
import {createDefaultConnections} from './commands/create_default_connections';
import {openComposer} from './commands/open_composer';
import {showSchemaCommand} from './commands/show_schema';
import {DocumentMetadata} from '../common/types/query_spec';

function getNewClientId(): string {
  return uuid();
}

export const setupSubscriptions = async (
  context: vscode.ExtensionContext,
  worker: WorkerConnection,
  client: BaseLanguageClient
) => {
  MALLOY_EXTENSION_STATE.setExtensionUri(context.extensionUri);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.openComposer',
      async (
        sourceName: string,
        viewName?: string,
        initialQuery?: Malloy.Query,
        documentMeta?: DocumentMetadata
      ) => {
        return openComposer(
          worker,
          sourceName,
          viewName,
          initialQuery,
          documentMeta
        );
      }
    )
  );

  // Run Query (whole file)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.runQueryFile',
      (queryIndex?: number) => runQueryFileCommand(worker, queryIndex)
    )
  );

  // Run query
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.runQuery',
      (query: string, name?: string, defaultTab?: string) =>
        runQueryCommand(worker, query, name, defaultTab)
    )
  );

  // Run named query
  context.subscriptions.push(
    vscode.commands.registerCommand('malloy.runNamedQuery', (name: string) =>
      runNamedQuery(worker, name)
    )
  );

  // Run query at cursor
  context.subscriptions.push(
    vscode.commands.registerCommand('malloy.runQueryAtCursor', () =>
      runQueryAtCursorCommand(client)
    )
  );

  // Show Schema (whole file)
  context.subscriptions.push(
    vscode.commands.registerCommand('malloy.showSchemaFile', (uri: string) =>
      showSchemaFileCommand(worker, uri)
    )
  );

  // Show Schema (source)
  context.subscriptions.push(
    vscode.commands.registerCommand('malloy.showSchema', (explore: string) =>
      showSchemaCommand(worker, explore)
    )
  );

  // Show SQL (whole file)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.showSQLFile',
      (queryIndex?: number) => showSQLFileCommand(worker, queryIndex)
    )
  );

  // Show SQL
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.showSQL',
      (query: string, name?: string) => showSQLCommand(worker, query, name)
    )
  );

  // Show named query SQL
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.showSQLNamedQuery',
      (name: string) => showSQLNamedQueryCommand(worker, name)
    )
  );

  // Copy Path
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.copyFieldPath',
      copyFieldPathCommand
    )
  );

  // Copy To ClipBoard
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.copyToClipboard',
      (val: string, type: string) => copyToClipboardCommand(val, type)
    )
  );

  // source
  context.subscriptions.push(
    vscode.commands.registerCommand('malloy.openUrlInBrowser', (url: string) =>
      openUrlInBrowser(url)
    )
  );

  // Schema Tree and related commands
  const schemaTree = new SchemaProvider(context, client, worker);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('malloySchema', schemaTree)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('malloy.refreshSchema', () =>
      schemaTree.refresh(true)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.runTurtleFromSchema',
      runTurtleFromSchemaCommand
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.runNamedQueryFromSchema',
      runNamedQueryFromSchemaCommand
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.goToDefinitionFromSchema',
      goToDefinitionFromSchemaCommand
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.previewFromSchema',
      previewFromSchemaCommand
    )
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() =>
      vscode.commands.executeCommand('malloy.refreshSchema')
    )
  );

  // Show Licenses
  context.subscriptions.push(
    vscode.commands.registerCommand('malloy.showLicenses', showLicensesCommand)
  );

  // Tracking
  let clientId: string | undefined =
    context.globalState.get('malloy_client_id');
  if (clientId === undefined) {
    clientId = getNewClientId();
    noAwait(context.globalState.update('malloy_client_id', clientId));
  }
  MALLOY_EXTENSION_STATE.setClientId(clientId);

  // Connection Defaults
  context.globalState.setKeysForSync(['malloy_created_default']);
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.createDefaultConnections',
      (force: boolean) => createDefaultConnections(context, force)
    )
  );
  await vscode.commands.executeCommand(
    'malloy.createDefaultConnections',
    false
  );

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async e => {
      if (e.languageId === 'malloy') {
        noAwait(trackModelLoad());
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async e => {
      noAwait(vscode.commands.executeCommand('malloy.refreshSchema'));
      if (e.languageId === 'malloy') {
        noAwait(trackModelSave());
      }
    })
  );

  // Malloy HelpView provider.
  const provider = new HelpViewProvider(context.extensionUri);

  // Malloy help view.
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('malloyHelp', provider)
  );

  // Notebooks
  activateNotebookSerializer(context);
  activateNotebookController(context, client, worker);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.newUntitledNotebook',
      newUntitledNotebookCommand
    )
  );
};

export const setupFileMessaging = (
  context: vscode.ExtensionContext,
  client: GenericConnection,
  fileHandler: FileHandler
) => {
  context.subscriptions.push(
    client.onRequest('malloy/fetchFile', async (event: FetchFileEvent) => {
      malloyLog.appendLine(`fetchFile returning ${event.uri}`);
      return await fileHandler.fetchFile(event.uri);
    })
  );

  context.subscriptions.push(
    client.onRequest(
      'malloy/fetchBinaryFile',
      async (event: FetchBinaryFileEvent) => {
        malloyLog.appendLine(`fetchBinaryFile returning ${event.uri}`);
        return await fileHandler.fetchBinaryFile(event.uri);
      }
    )
  );
  context.subscriptions.push(
    client.onRequest(
      'malloy/fetchCellData',
      async (event: FetchCellDataEvent) => {
        malloyLog.appendLine(`fetchCellData returning ${event.uri}`);
        return await fileHandler.fetchCellData(event.uri);
      }
    )
  );

  context.subscriptions.push(
    client.onRequest('malloy/fetch', async (message: WorkerFetchMessage) => {
      malloyLog.appendLine(`reading file ${message.uri}`);
      return await fileHandler.fetchFile(message.uri);
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(e => {
      MALLOY_EXTENSION_STATE.setActivePosition(e.selections[0].start);
    })
  );

  context.subscriptions.push(
    client.onRequest(
      'malloy/getSecret',
      async ({key, promptIfMissing}: WorkerGetSecretMessage) => {
        let secret = await context.secrets.get(key);
        if (!secret && promptIfMissing) {
          secret = await vscode.window.showInputBox({
            title: promptIfMissing,
            ignoreFocusOut: true,
            password: true,
          });
          if (secret) {
            await context.secrets.store(key, secret);
          }
        }
        return secret;
      }
    )
  );
};

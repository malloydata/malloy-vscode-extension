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
  LanguageClient,
  LanguageClientOptions,
} from 'vscode-languageclient/browser';

import {setupFileMessaging, setupSubscriptions} from '../subscriptions';
import {connectionManager} from './connection_manager';
import {
  ConnectionItem,
  ConnectionsProvider,
} from '../tree_views/connections_view';
import {editConnectionsCommand} from './commands/edit_connections';
import {fileHandler} from '../utils/files';
import {WorkerConnectionBrowser} from './worker_connection_browser';
let client: LanguageClient;

export function activate(context: vscode.ExtensionContext): void {
  setupLanguageServer(context);
  const worker = new WorkerConnectionBrowser(context, client, fileHandler);
  setupSubscriptions(context, worker, client);

  const connectionsTree = new ConnectionsProvider(context, connectionManager);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('malloyConnections', connectionsTree)
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async e => {
      if (e.affectsConfiguration('malloy')) {
        await connectionManager.onConfigurationUpdated();
        connectionsTree.refresh();
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.editConnections',
      (item?: ConnectionItem) => editConnectionsCommand(worker, item?.id)
    )
  );
}

export async function deactivate(): Promise<void | undefined> {
  if (client) {
    await client.stop();
  }
}

async function setupLanguageServer(
  context: vscode.ExtensionContext
): Promise<void> {
  const documentSelector = [
    {language: 'malloy'},
    {language: 'malloy-sql'},
    {language: 'malloy-notebook'},
  ];

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {
      configurationSection: 'malloy',
    },
    initializationOptions: {},
    connectionOptions: {
      // If the server crashes X times in Y mins(e.g., 3 min), it won't get
      // restarted again(https://github.com/microsoft/vscode-languageserver-node/blob/1320922f95ef182df2cf76b7c96b1a2d3ba14c2a/client/src/common/client.ts#L438).
      // We can be overly confident and set it to a large number. For now, set the max restart count to Number.MAX_SAFE_INTEGER.
      maxRestartCount: Number.MAX_SAFE_INTEGER,
    },
  };

  client = createWorkerLanguageClient(context, clientOptions);

  await client.start();

  setupFileMessaging(context, client, fileHandler);
}

function createWorkerLanguageClient(
  context: vscode.ExtensionContext,
  clientOptions: LanguageClientOptions
) {
  // Create a worker. The worker main file implements the language server.
  const serverMain = vscode.Uri.joinPath(
    context.extensionUri,
    'dist/server_browser.js'
  );
  const worker = new Worker(serverMain.toString(true));

  // create the language server client to communicate with the server running in the worker
  return new LanguageClient(
    'malloy',
    'Malloy Language Server',
    clientOptions,
    worker
  );
}

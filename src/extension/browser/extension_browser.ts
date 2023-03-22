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
/* eslint-disable no-console */

import * as vscode from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
} from 'vscode-languageclient/browser';

// import { WorkerConnection } from "../../worker/browser/worker_connection";
import {WorkerConnection} from '../../worker/browser/workerless_worker';
import {setupSubscriptions} from '../subscriptions';
import {MalloyConfig} from '../types';
import {connectionManager} from './connection_manager';
import {ConnectionsProvider} from '../tree_views/connections_view';
import {editConnectionsCommand} from './commands/edit_connections';
import {initFileMessaging, VSCodeURLReader} from '../utils';

let client: LanguageClient;
let worker: WorkerConnection;

export let extensionModeProduction: boolean;

export function activate(context: vscode.ExtensionContext): void {
  const urlReader = new VSCodeURLReader();
  setupWorker(context);
  setupSubscriptions(context, urlReader, connectionManager, worker);

  const connectionsTree = new ConnectionsProvider(context, connectionManager);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('malloyConnections', connectionsTree)
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async e => {
      if (e.affectsConfiguration('malloy')) {
        await connectionManager.onConfigurationUpdated();
        connectionsTree.refresh();
        sendWorkerConfig();
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.editConnections',
      editConnectionsCommand
    )
  );
  setupLanguageServer(context);
}

export async function deactivate(): Promise<void> | undefined {
  if (client) {
    await client.stop();
  }
  if (worker) {
    worker.send({type: 'exit'});
  }
}

async function setupLanguageServer(
  context: vscode.ExtensionContext
): Promise<void> {
  const documentSelector = [{language: 'malloy'}];

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {
      configurationSection: 'malloy',
    },
    initializationOptions: {},
  };

  const client = createWorkerLanguageClient(context, clientOptions);

  client.start();
  await client.onReady();

  initFileMessaging(client);
}

function sendWorkerConfig() {
  const rawConfig = vscode.workspace.getConfiguration('malloy');
  // Strip out functions
  const config: MalloyConfig = JSON.parse(JSON.stringify(rawConfig));
  worker.send({
    type: 'config',
    config,
  });
}

function setupWorker(context: vscode.ExtensionContext): void {
  worker = new WorkerConnection(context);
  sendWorkerConfig();
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

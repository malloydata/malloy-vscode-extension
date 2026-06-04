/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
} from 'vscode-languageclient/browser';

import {setupFileMessaging, setupSubscriptions} from '../subscriptions';
import {connectionConfigManager} from './connection_config_manager_browser';
import {
  ConnectionGroupItem,
  ConnectionsProvider,
} from '../tree_views/connections_view';
import {
  editConnectionsCommand,
  createConnectionCommand,
  viewConfigConnectionCommand,
} from './commands/edit_connections';
import {ConnectionConfigEntry} from '@malloydata/malloy';
import {fileHandler} from '../utils/files';
import {WorkerConnectionBrowser} from './worker_connection_browser';
let client: LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
  await setupLanguageServer(context);
  const worker = new WorkerConnectionBrowser(context, client, fileHandler);
  await setupSubscriptions(context, worker, client);

  const connectionsTree = new ConnectionsProvider(
    context,
    connectionConfigManager
  );
  // Wire up the sidebar to ask the language server for config resolution
  connectionsTree.setConfigSourceResolver(async fileUri =>
    client.sendRequest('malloy/getEffectiveConfigSource', {fileUri})
  );

  context.subscriptions.push(
    connectionsTree,
    vscode.window.registerTreeDataProvider('malloyConnections', connectionsTree)
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async e => {
      if (e.affectsConfiguration('malloy')) {
        await connectionConfigManager.onConfigurationUpdated();
        connectionsTree.refresh();
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.editConnections',
      (connectionNameOrItem?: unknown) => {
        void editConnectionsCommand(context, worker, connectionNameOrItem);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.viewConfigConnection',
      (name: string, entry: unknown, configFileUri: string) => {
        viewConfigConnectionCommand(
          context,
          worker,
          name,
          entry as ConnectionConfigEntry,
          configFileUri
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.createConnection',
      (connectionName: string) => {
        createConnectionCommand(context, worker, connectionName);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.openConfigFile',
      (groupItem: unknown) => {
        if (
          groupItem instanceof ConnectionGroupItem &&
          groupItem.configFileUri
        ) {
          const uri = vscode.Uri.parse(groupItem.configFileUri);
          void vscode.window.showTextDocument(uri);
        }
      }
    )
  );

  // Fetch registered connection types from the worker and inject into tree view
  worker
    .sendRequest('malloy/getConnectionTypeInfo', {})
    .then(typeInfo => {
      connectionsTree.setRegisteredTypes(
        typeInfo.registeredTypes,
        typeInfo.typeDisplayNames,
        typeInfo.defaultConnections
      );
    })
    .catch(err => {
      console.warn('Failed to fetch connection type info:', err);
    });
}

export async function deactivate(): Promise<void | undefined> {
  if (client) {
    await client.stop();
  }
}

async function setupLanguageServer(
  context: vscode.ExtensionContext
): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel(
    'Malloy Language Server'
  );
  context.subscriptions.push(outputChannel);
  const documentSelector = [
    // Regular files
    {language: 'malloy'},
    {language: 'malloy-sql'},
    // Notebook cells
    {
      language: 'malloy',
      notebook: {notebookType: 'malloy-notebook', scheme: '*'},
    },
    {
      language: 'malloy-sql',
      notebook: {notebookType: 'malloy-notebook', scheme: '*'},
    },
  ];

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    outputChannel,
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

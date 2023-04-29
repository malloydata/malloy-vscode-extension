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
import * as os from 'os';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import {editConnectionsCommand} from './commands/edit_connections';
import {ConnectionsProvider} from '../tree_views/connections_view';
import {connectionManager} from './connection_manager';
import {setupFileMessaging, setupSubscriptions} from '../subscriptions';
import {fileHandler} from '../utils';
import {MALLOY_EXTENSION_STATE} from '../state';

let client: LanguageClient;

const cloudshellEnv = () => {
  const cloudShellProject = vscode.workspace
    .getConfiguration('cloudcode')
    .get('cloudshell.project');
  if (cloudShellProject && typeof cloudShellProject === 'string') {
    process.env['DEVSHELL_PROJECT_ID'] = cloudShellProject;
    process.env['GOOGLE_CLOUD_PROJECT'] = cloudShellProject;
    process.env['GOOGLE_CLOUD_QUOTA_PROJECT'] = cloudShellProject;
  }
};

export function activate(context: vscode.ExtensionContext): void {
  cloudshellEnv();
  setupLanguageServer(context);
  setupSubscriptions(context, fileHandler, connectionManager, client);

  const connectionsTree = new ConnectionsProvider(context, connectionManager);

  MALLOY_EXTENSION_STATE.setHomeUri(vscode.Uri.file(os.homedir()));

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('malloyConnections', connectionsTree)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.editConnections',
      editConnectionsCommand
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async e => {
      if (e.affectsConfiguration('malloy')) {
        await connectionManager.onConfigurationUpdated();
        connectionsTree.refresh();
      }
      if (e.affectsConfiguration('cloudshell')) {
        cloudshellEnv();
      }
    })
  );
}

export async function deactivate(): Promise<void> | undefined {
  if (client) {
    await client.stop();
  }
}

async function setupLanguageServer(
  context: vscode.ExtensionContext
): Promise<void> {
  const serverModule = context.asAbsolutePath('dist/server_node.js');
  const debugOptions = {
    execArgv: [
      '--nolazy',
      '--inspect=6009',
      '--preserve-symlinks',
      '--enable-source-maps',
    ],
  };

  const serverOptions: ServerOptions = {
    run: {module: serverModule, transport: TransportKind.ipc},
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{language: 'malloy'}],
    synchronize: {
      configurationSection: 'malloy',
      fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc'),
    },
  };

  client = new LanguageClient(
    'malloy',
    'Malloy Language Server',
    serverOptions,
    clientOptions
  );

  client.start();
  await client.onReady();

  setupFileMessaging(context, client, fileHandler);
}

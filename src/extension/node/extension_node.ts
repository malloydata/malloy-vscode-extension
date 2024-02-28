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
import {
  ConnectionItem,
  ConnectionsProvider,
} from '../tree_views/connections_view';
import {connectionConfigManager} from './connection_config_manager_node';
import {setupFileMessaging, setupSubscriptions} from '../subscriptions';
import {fileHandler} from '../utils/files';
import {MALLOY_EXTENSION_STATE} from '../state';
import {WorkerConnectionNode} from './worker_connection_node';
import {WorkerGetSecretMessage} from '../../common/types/worker_message_types';
import {deletePassword, getPassword} from 'keytar';
import {noAwait} from '../../util/no_await';

let client: LanguageClient;

const cloudCodeEnv = () => {
  const cloudCodeConfig = vscode.workspace.getConfiguration('cloudcode');
  const cloudCodeProject = cloudCodeConfig.get('project');
  const cloudShellProject = cloudCodeConfig.get('cloudshell.project');
  const project = cloudCodeProject || cloudShellProject;

  if (project && typeof project === 'string') {
    process.env['DEVSHELL_PROJECT_ID'] = project;
    process.env['GOOGLE_CLOUD_PROJECT'] = project;
    process.env['GOOGLE_CLOUD_QUOTA_PROJECT'] = project;
  }
};

export function activate(context: vscode.ExtensionContext): void {
  noAwait(asyncActivate(context));
}

async function asyncActivate(context: vscode.ExtensionContext) {
  cloudCodeEnv();
  await setupLanguageServer(context);
  const worker = new WorkerConnectionNode(context, client, fileHandler);
  setupSubscriptions(context, worker, client);
  const connectionsTree = new ConnectionsProvider(
    context,
    connectionConfigManager
  );

  MALLOY_EXTENSION_STATE.setHomeUri(vscode.Uri.file(os.homedir()));

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('malloyConnections', connectionsTree)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'malloy.editConnections',
      (item?: ConnectionItem) =>
        editConnectionsCommand(context, worker, item?.id)
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async e => {
      if (e.affectsConfiguration('malloy')) {
        await connectionConfigManager.onConfigurationUpdated();
        connectionsTree.refresh();
      }
      if (e.affectsConfiguration('cloudcode')) {
        cloudCodeEnv();
      }
    })
  );

  context.subscriptions.push(
    client.onRequest(
      'malloy/getSecret',
      async ({key, promptIfMissing}: WorkerGetSecretMessage) => {
        // TODO(whscullin) Migrate old keytar values for now, remove with keytar
        // Once keytar is removed this can move to common browser/node code
        const value = await getPassword(
          'com.malloy-lang.vscode-extension',
          key
        );
        if (value) {
          await deletePassword('com.malloy-lang.vscode-extension', key);
          await context.secrets.store(key, value);
        }
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
}

export async function deactivate(): Promise<void> {
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
    documentSelector: [{language: 'malloy'}, {language: 'malloy-sql'}],
    synchronize: {
      configurationSection: ['malloy', 'cloudcode'],
    },
    connectionOptions: {
      // If the server crashes X times in Y mins(e.g., 3 min), it won't get
      // restarted again(https://github.com/microsoft/vscode-languageserver-node/blob/1320922f95ef182df2cf76b7c96b1a2d3ba14c2a/client/src/common/client.ts#L438).
      // We can be overly confident and set it to a large number. For now, set the max restart count to Number.MAX_SAFE_INTEGER.
      maxRestartCount: Number.MAX_SAFE_INTEGER,
    },
  };

  client = new LanguageClient(
    'malloy',
    'Malloy Language Server',
    serverOptions,
    clientOptions
  );

  await client.start();

  setupFileMessaging(context, client, fileHandler);
}

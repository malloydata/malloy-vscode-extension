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

import * as vscode from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { editConnectionsCommand } from "./commands/edit_connections";
import { showLicensesCommand } from "../commands/show_licenses";
import { ConnectionsProvider } from "../tree_views/connections_view";
import { WorkerConnection } from "../../worker/node/worker_connection";
import { MalloyConfig } from "../types";
import { connectionManager } from "./connection_manager";
import { setupSubscriptions } from "../subscriptions";
import { MALLOY_EXTENSION_STATE } from "../state";
import { getNewClientId, VSCodeURLReader } from "./utils";
import { getWorker, setWorker } from "../../worker/worker";

let client: LanguageClient;

export let extensionModeProduction: boolean;

export function activate(context: vscode.ExtensionContext): void {
  const urlReader = new VSCodeURLReader();
  setupSubscriptions(context, urlReader, connectionManager);
  const connectionsTree = new ConnectionsProvider(context, connectionManager);

  // Show Licenses
  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.showLicenses", showLicensesCommand)
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("malloyConnections", connectionsTree)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "malloy.editConnections",
      editConnectionsCommand
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("malloy")) {
        await connectionManager.onConfigurationUpdated();
        connectionsTree.refresh();
        sendWorkerConfig();
      }
    })
  );

  let clientId: string | undefined =
    context.globalState.get("malloy_client_id");
  if (clientId === undefined) {
    clientId = getNewClientId();
    context.globalState.update("malloy_client_id", clientId);
  }
  MALLOY_EXTENSION_STATE.setClientId(clientId);

  setupLanguageServer(context);
  setupWorker(context);
}

export async function deactivate(): Promise<void> | undefined {
  if (client) {
    await client.stop();
  }
  const worker = getWorker();
  if (worker) {
    worker.send({ type: "exit" });
  }
}

function setupLanguageServer(context: vscode.ExtensionContext): void {
  const serverModule = context.asAbsolutePath("dist/server_node.js");
  const debugOptions = {
    execArgv: [
      "--nolazy",
      "--inspect=6009",
      "--preserve-symlinks",
      "--enable-source-maps",
    ],
  };

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "malloy" }],
    synchronize: {
      configurationSection: "malloy",
      fileEvents: vscode.workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };

  client = new LanguageClient(
    "malloy",
    "Malloy Language Server",
    serverOptions,
    clientOptions
  );

  client.start();
}

function sendWorkerConfig() {
  getWorker().send({
    type: "config",
    config: vscode.workspace.getConfiguration(
      "malloy"
    ) as unknown as MalloyConfig,
  });
}

function setupWorker(context: vscode.ExtensionContext): void {
  const worker = new WorkerConnection(context);
  setWorker(worker);
  sendWorkerConfig();
}

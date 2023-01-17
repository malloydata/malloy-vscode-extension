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
import {
  runTurtleFromSchemaCommand,
  SchemaProvider,
} from "./tree_views/schema_view";
import {
  copyFieldPathCommand,
  editConnectionsCommand,
  runNamedQuery,
  runNamedSQLBlock,
  runQueryCommand,
  runQueryFileCommand,
  runUnnamedSQLBlock,
  showLicensesCommand,
} from "./commands";
import { CONNECTION_MANAGER, MALLOY_EXTENSION_STATE } from "./state";
import { ConnectionsProvider } from "./tree_views/connections_view";
import { WorkerConnection } from "../worker/worker_connection";
import { MalloyConfig } from "./types";
import { getNewClientId } from "./utils";
import { trackModelLoad, trackModelSave } from "./telemetry";

let client: LanguageClient;
let worker: WorkerConnection;

export let extensionModeProduction: boolean;

export function activate(context: vscode.ExtensionContext): void {
  // Show Licenses
  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.showLicenses", showLicensesCommand)
  );

  // Run Query (whole file)
  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.runQueryFile", runQueryFileCommand)
  );

  // Run query
  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.runQuery", runQueryCommand)
  );

  // Run named query
  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.runNamedQuery", runNamedQuery)
  );

  // Run named SQL block
  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.runNamedSQLBlock", runNamedSQLBlock)
  );

  // Run unnamed SQL block
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "malloy.runUnnamedSQLBlock",
      runUnnamedSQLBlock
    )
  );

  // Copy Field Path
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "malloy.copyFieldPath",
      copyFieldPathCommand
    )
  );

  const schemaTree = new SchemaProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("malloySchema", schemaTree)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.refreshSchema", () =>
      schemaTree.refresh()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "malloy.runTurtleFromSchema",
      runTurtleFromSchemaCommand
    )
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() =>
      vscode.commands.executeCommand("malloy.refreshSchema")
    )
  );

  const connectionsTree = new ConnectionsProvider();

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
        await CONNECTION_MANAGER.onConfigurationUpdated();
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

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async (e) => {
      if (e.languageId === "malloy") {
        trackModelLoad();
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (e) => {
      vscode.commands.executeCommand("malloy.refreshSchema");
      if (e.languageId === "malloy") {
        trackModelSave();
      }
    })
  );

  setupLanguageServer(context);
  setupWorker(context);
}

export async function deactivate(): Promise<void> | undefined {
  if (client) {
    await client.stop();
  }
  if (worker) {
    worker.send({ type: "exit" });
  }
}

function setupLanguageServer(context: vscode.ExtensionContext): void {
  const serverModule = context.asAbsolutePath("dist/server.js");
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

export function getWorker(): WorkerConnection {
  return worker;
}

function sendWorkerConfig() {
  worker.send({
    type: "config",
    config: vscode.workspace.getConfiguration(
      "malloy"
    ) as unknown as MalloyConfig,
  });
}

function setupWorker(context: vscode.ExtensionContext): void {
  worker = new WorkerConnection(context);
  sendWorkerConfig();
}

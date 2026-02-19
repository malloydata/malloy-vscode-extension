/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import {ConnectionConfigEntry} from '@malloydata/malloy';
import {SingleConnectionPanel} from '../single_connection_editor';
import {WorkerConnection} from '../worker_connection';
import {ConnectionItem} from '../tree_views/connections_view';

let panel: SingleConnectionPanel | null = null;

function ensurePanel(
  context: vscode.ExtensionContext,
  worker: WorkerConnection
): SingleConnectionPanel {
  if (!panel) {
    panel = new SingleConnectionPanel(context, worker);
    panel.onDispose(() => (panel = null));
  }
  return panel;
}

interface ConnectionTypeQuickPickItem extends vscode.QuickPickItem {
  typeName: string;
}

export async function editConnectionsCommand(
  context: vscode.ExtensionContext,
  worker: WorkerConnection,
  connectionNameOrItem?: unknown
): Promise<void> {
  const p = ensurePanel(context, worker);

  // If called with a settings connection item or a name string, edit it.
  // If called with a default connection item, create a new one for that type.
  // If called with no argument (or a group item), show the type picker.
  if (connectionNameOrItem instanceof ConnectionItem) {
    if (connectionNameOrItem.contextValue === 'connection.defaults') {
      void p.createConnection(connectionNameOrItem.label as string);
      return;
    }
    void p.editConnection(connectionNameOrItem.label as string);
    return;
  }
  if (typeof connectionNameOrItem === 'string') {
    void p.editConnection(connectionNameOrItem);
    return;
  }

  {
    const typeInfo = await worker.sendRequest(
      'malloy/getConnectionTypeInfo',
      {}
    );
    const items: ConnectionTypeQuickPickItem[] = typeInfo.registeredTypes.map(
      t => ({
        label: typeInfo.typeDisplayNames[t] ?? t,
        description: t,
        typeName: t,
      })
    );
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select connection type',
    });
    if (picked) {
      void p.createConnection(picked.typeName);
    }
  }
}

export function createConnectionCommand(
  context: vscode.ExtensionContext,
  worker: WorkerConnection,
  typeName: string
): void {
  const p = ensurePanel(context, worker);
  void p.createConnection(typeName);
}

export function viewConfigConnectionCommand(
  context: vscode.ExtensionContext,
  worker: WorkerConnection,
  name: string,
  entry: ConnectionConfigEntry,
  configFileUri: string
): void {
  const p = ensurePanel(context, worker);
  void p.viewConfigConnection(name, entry, configFileUri);
}

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
import {connectionConfigManager} from '../connection_config_manager_node';
import {ConnectionConfig} from '../../../common/types/connection_manager_types';
import {deletePassword, getPassword} from 'keytar';
import {EditConnectionPanel} from '../../connection_editor';
import {WorkerConnection} from '../../worker_connection';

let panel: EditConnectionPanel | null = null;

export function editConnectionsCommand(
  context: vscode.ExtensionContext,
  worker: WorkerConnection,
  id?: string
): void {
  if (!panel) {
    panel = new EditConnectionPanel(
      connectionConfigManager,
      worker,
      (connections: ConnectionConfig[]) =>
        handleConnectionPreLoad(context, connections),
      (connections: ConnectionConfig[]) =>
        handleConnectionsPreSave(context, connections)
    );
    panel.onDidDispose(() => (panel = null));
  }
  panel.reveal(id);
}

/**
 * Perform setup on the connections being sent to the webview.
 *
 * @param connections The connection configs.
 * @returns An updated list of connections
 *
 * - Handles scrubbing passwords and putting them in the keychain.
 */
async function handleConnectionPreLoad(
  context: vscode.ExtensionContext,
  connections: ConnectionConfig[]
): Promise<ConnectionConfig[]> {
  const modifiedConnections = [];
  for (let connection of connections) {
    // TODO(whscullin) keytar - delete
    if ('useKeychainPassword' in connection && connection.useKeychainPassword) {
      const key = `connections.${connection.id}.password`;
      const password =
        (await getPassword('com.malloy-lang.vscode-extension', key)) ||
        undefined;
      connection = {
        ...connection,
        password,
      };
    }
    if ('password' in connection && connection.password) {
      const key = `connections.${connection.id}.password`;
      const password = await context.secrets.get(key);
      connection = {
        ...connection,
        password,
      };
    }
    if ('motherDuckToken' in connection && connection.motherDuckToken) {
      const key = `connections.${connection.id}.motherDuckToken`;
      const motherDuckToken = await context.secrets.get(key);
      connection = {
        ...connection,
        motherDuckToken,
      };
    }
    modifiedConnections.push(connection);
  }
  return modifiedConnections;
}

/**
 * Perform cleanup on the connections object received from the webview,
 * and prepare to save the config.
 *
 * @param connections The connection configs received from the webview.
 * @returns An updated list of connections
 *
 * - Handles scrubbing passwords and putting them in the keychain.
 */
// TODO(whscullin) keytar
// This can be moved to common code once keytar is removed
async function handleConnectionsPreSave(
  context: vscode.ExtensionContext,
  connections: ConnectionConfig[]
): Promise<ConnectionConfig[]> {
  const modifiedConnections = [];
  for (let connection of connections) {
    if ('password' in connection) {
      const key = `connections.${connection.id}.password`;
      // TODO(whscullin) keytar - delete
      await deletePassword('com.malloy-lang.vscode-extension', key);
      if (!connection.password) {
        await context.secrets.delete(key);
      }
      if (connection.password) {
        await context.secrets.store(key, connection.password);
        connection = {
          ...connection,
          // Change the config to trigger a connection reload
          password: `$secret-${Date.now().toString()}$`,
          useKeychainPassword: undefined,
        };
      }
    }
    if ('motherDuckToken' in connection && connection.motherDuckToken) {
      const key = `connections.${connection.id}.motherDuckToken`;
      await context.secrets.store(key, connection.motherDuckToken);
      connection = {
        ...connection,
        // Change the config to trigger a connection reload
        motherDuckToken: `$secret-${Date.now().toString()}$`,
      };
    }
    modifiedConnections.push(connection);
  }
  return modifiedConnections;
}

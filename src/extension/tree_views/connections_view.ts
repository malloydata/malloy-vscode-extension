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
  ConnectionBackendNames,
  ConnectionConfig,
  getDefaultIndex,
} from '../../common/types/connection_manager_types';
import {VSCodeConnectionManager} from '../connection_manager';

export class ConnectionsProvider
  implements vscode.TreeDataProvider<ConnectionItem>
{
  constructor(
    private context: vscode.ExtensionContext,
    private connectionManager: VSCodeConnectionManager
  ) {}

  getTreeItem(element: ConnectionItem): vscode.TreeItem {
    return element;
  }

  private _onDidChangeTreeData: vscode.EventEmitter<
    ConnectionItem | undefined
  > = new vscode.EventEmitter<ConnectionItem | undefined>();

  readonly onDidChangeTreeData: vscode.Event<ConnectionItem | undefined> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async getChildren(element?: ConnectionItem): Promise<ConnectionItem[]> {
    if (element === undefined) {
      const availableBackends = this.connectionManager.getAvailableBackends();
      const config = this.connectionManager.getAllConnectionConfigs();
      const defaultIndex = getDefaultIndex(config);
      return config.map(
        (config, index) =>
          new ConnectionItem(
            this.context,
            config,
            index === defaultIndex,
            availableBackends.includes(config.backend)
          )
      );
    } else {
      return [];
    }
  }
}

export class ConnectionItem extends vscode.TreeItem {
  constructor(
    private context: vscode.ExtensionContext,
    config: ConnectionConfig,
    isDefault: boolean,
    isAvailable: boolean
  ) {
    super(config.name, vscode.TreeItemCollapsibleState.None);

    const backendName = ConnectionBackendNames[config.backend];
    this.id = config.id;
    this.description = `(${backendName}${isDefault ? ', default' : ''}${
      config.isGenerated ? ', automatically generated' : ''
    }) ${isAvailable ? '' : '(Not available)'}`;
  }

  override contextValue = 'connection';

  override command = {
    title: 'Edit connection',
    command: 'malloy.editConnections',
    arguments: [this],
  };

  override iconPath = new vscode.ThemeIcon('database');
}

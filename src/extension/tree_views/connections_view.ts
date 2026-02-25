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
import {MalloyConfig, ConnectionConfigEntry} from '@malloydata/malloy';

import {ConnectionConfigManager} from '../../common/types/connection_manager_types';
import {getMalloyConfig} from '../utils/config';
import {MALLOY_EXTENSION_STATE} from '../state';

export type ConnectionTreeItem = ConnectionGroupItem | ConnectionItem;

interface ConfigFileInfo {
  uri: vscode.Uri;
  relativePath: string;
  connections: Record<string, ConnectionConfigEntry>;
}

export class ConnectionsProvider
  implements vscode.TreeDataProvider<ConnectionTreeItem>, vscode.Disposable
{
  private configFiles: Map<string, ConfigFileInfo> = new Map();
  private watcher: vscode.Disposable | undefined;
  private dirty = true;
  private registeredTypes: string[] = [];
  private typeDisplayNames: Record<string, string> = {};

  constructor(
    private context: vscode.ExtensionContext,
    private connectionConfigManager: ConnectionConfigManager
  ) {
    this.watcher = this.setupWatcher();
  }

  setRegisteredTypes(
    types: string[],
    displayNames: Record<string, string>
  ): void {
    this.registeredTypes = types;
    this.typeDisplayNames = displayNames;
    this.refresh();
  }

  private displayName(typeName: string): string {
    return this.typeDisplayNames[typeName] ?? typeName;
  }

  dispose(): void {
    this.watcher?.dispose();
  }

  getTreeItem(element: ConnectionTreeItem): vscode.TreeItem {
    return element;
  }

  private _onDidChangeTreeData = new vscode.EventEmitter<
    ConnectionTreeItem | undefined
  >();

  readonly onDidChangeTreeData: vscode.Event<ConnectionTreeItem | undefined> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this.dirty = true;
    this._onDidChangeTreeData.fire(undefined);
  }

  async getChildren(
    element?: ConnectionTreeItem
  ): Promise<ConnectionTreeItem[]> {
    if (element === undefined) {
      return this.buildGroups();
    }
    if (element instanceof ConnectionGroupItem) {
      return element.children;
    }
    return [];
  }

  private async buildGroups(): Promise<ConnectionGroupItem[]> {
    const groups: ConnectionGroupItem[] = [];
    const projectOnly =
      getMalloyConfig().get<boolean>('projectConnectionsOnly') ?? false;

    // 1. Config file section(s) — one per discovered config file
    if (this.dirty) {
      await this.discoverConfigFiles();
      this.dirty = false;
    }

    const allConfigNames = new Set<string>();
    for (const [, configFile] of this.configFiles) {
      const children = Object.entries(configFile.connections).map(
        ([name, entry]) => {
          allConfigNames.add(name);
          return ConnectionItem.config(
            name,
            this.displayName(entry.is),
            configFile.uri,
            entry
          );
        }
      );
      if (children.length > 0) {
        groups.push(
          new ConnectionGroupItem(
            `Config: ${configFile.relativePath}`,
            'connectionGroup.config',
            children,
            new vscode.ThemeIcon('file-code'),
            configFile.uri.toString()
          )
        );
      }
    }

    if (projectOnly) {
      return groups;
    }

    // 2. Settings section
    const settingsConfig = this.connectionConfigManager.getConnectionsConfig();
    if (settingsConfig) {
      const children = Object.entries(settingsConfig).map(([name, entry]) => {
        const shadowed = allConfigNames.has(name);
        const displayType = this.displayName(entry.is);
        const suffix = shadowed ? ' (shadowed)' : '';
        return ConnectionItem.settings(name, `${displayType}${suffix}`);
      });
      if (children.length > 0) {
        groups.push(
          new ConnectionGroupItem(
            'Settings',
            'connectionGroup.settings',
            children,
            new vscode.ThemeIcon('gear')
          )
        );
      }
    }

    // 3. Defaults section — from connection registry
    const settingsNames = new Set(
      settingsConfig ? Object.keys(settingsConfig) : []
    );
    const defaultChildren = this.registeredTypes
      .filter(
        typeName =>
          !allConfigNames.has(typeName) && !settingsNames.has(typeName)
      )
      .map(typeName =>
        ConnectionItem.defaultConnection(typeName, this.displayName(typeName))
      );
    if (defaultChildren.length > 0) {
      groups.push(
        new ConnectionGroupItem(
          'Defaults',
          'connectionGroup.defaults',
          defaultChildren,
          new vscode.ThemeIcon('package')
        )
      );
    }

    return groups;
  }

  private async discoverConfigFiles(): Promise<void> {
    this.configFiles.clear();

    // 1. Workspace config files
    let files: vscode.Uri[];
    try {
      files = await vscode.workspace.findFiles(
        '**/malloy-config.json',
        '**/node_modules/**',
        10
      );
    } catch {
      files = [];
    }

    for (const fileUri of files) {
      await this.loadConfigFile(fileUri);
    }

    // 2. Global config directory (fallback when no workspace config found)
    const projectOnly =
      getMalloyConfig().get<boolean>('projectConnectionsOnly') ?? false;
    if (this.configFiles.size === 0 && !projectOnly) {
      const globalDir = getMalloyConfig().get<string>('globalConfigDirectory');
      if (globalDir) {
        const homeUri = MALLOY_EXTENSION_STATE.getHomeUri();
        const expandedDir = homeUri
          ? globalDir.replace(/^~/, homeUri.fsPath)
          : globalDir;
        const globalUri = vscode.Uri.file(`${expandedDir}/malloy-config.json`);
        await this.loadConfigFile(globalUri, 'global');
      }
    }
  }

  private async loadConfigFile(
    fileUri: vscode.Uri,
    labelOverride?: string
  ): Promise<void> {
    try {
      const content = await vscode.workspace.fs.readFile(fileUri);
      const text = new TextDecoder().decode(content);
      const parsed = new MalloyConfig(text);
      const relativePath =
        labelOverride ?? vscode.workspace.asRelativePath(fileUri, true);
      this.configFiles.set(fileUri.toString(), {
        uri: fileUri,
        relativePath,
        connections: parsed.connectionMap ?? {},
      });
    } catch (error) {
      console.warn(`Failed to parse config file ${fileUri.fsPath}:`, error);
    }
  }

  private setupWatcher(): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher(
      '**/malloy-config.json'
    );

    const onFileChange = () => this.refresh();

    return vscode.Disposable.from(
      watcher,
      watcher.onDidCreate(onFileChange),
      watcher.onDidChange(onFileChange),
      watcher.onDidDelete(onFileChange)
    );
  }
}

type GroupContextValue =
  | 'connectionGroup.config'
  | 'connectionGroup.settings'
  | 'connectionGroup.defaults';

export class ConnectionGroupItem extends vscode.TreeItem {
  constructor(
    label: string,
    public override readonly contextValue: GroupContextValue,
    public readonly children: ConnectionItem[],
    icon: vscode.ThemeIcon,
    uriKey?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.id = `group:${contextValue}${uriKey ? `:${uriKey}` : ''}`;
    this.iconPath = icon;
  }
}

type ItemContextValue =
  | 'connection.config'
  | 'connection.settings'
  | 'connection.defaults';

export class ConnectionItem extends vscode.TreeItem {
  private constructor(
    name: string,
    typeName: string,
    section: ItemContextValue
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.id = `${section}:${name}`;
    this.description = `(${typeName})`;
    this.contextValue = section;
    this.iconPath = new vscode.ThemeIcon('database');
  }

  static config(
    name: string,
    typeName: string,
    configFileUri: vscode.Uri,
    entry: ConnectionConfigEntry
  ): ConnectionItem {
    const item = new ConnectionItem(name, typeName, 'connection.config');
    item.id = `connection.config:${configFileUri.toString()}:${name}`;
    item.command = {
      title: 'View config connection',
      command: 'malloy.viewConfigConnection',
      arguments: [name, entry, configFileUri.toString()],
    };
    return item;
  }

  static settings(name: string, typeName: string): ConnectionItem {
    const item = new ConnectionItem(name, typeName, 'connection.settings');
    item.command = {
      title: 'Edit connection',
      command: 'malloy.editConnections',
      arguments: [name],
    };
    return item;
  }

  static defaultConnection(name: string, typeName: string): ConnectionItem {
    const item = new ConnectionItem(name, typeName, 'connection.defaults');
    item.tooltip = `Default connection (implicit, zero-config). Click to customize.`;
    item.command = {
      title: 'Create connection from default',
      command: 'malloy.createConnection',
      arguments: [name],
    };
    return item;
  }

  override contextValue: ItemContextValue = 'connection.settings';
}

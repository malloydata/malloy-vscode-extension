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
  private activeConfigFile: ConfigFileInfo | undefined;
  private watcher: vscode.Disposable | undefined;
  private editorWatcher: vscode.Disposable | undefined;
  private dirty = true;
  private registeredTypes: string[] = [];
  private typeDisplayNames: Record<string, string> = {};
  /** Maps default connection name → registered type name. */
  private defaultConnections: Record<string, string> = {};
  private activeFileUri: vscode.Uri | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private connectionConfigManager: ConnectionConfigManager
  ) {
    this.watcher = this.setupWatcher();
    this.activeFileUri = vscode.window.activeTextEditor?.document.uri;
    this.editorWatcher = vscode.window.onDidChangeActiveTextEditor(editor => {
      const newUri = editor?.document.uri;
      if (newUri?.toString() !== this.activeFileUri?.toString()) {
        this.activeFileUri = newUri;
        this.refresh();
      }
    });
  }

  setRegisteredTypes(
    types: string[],
    displayNames: Record<string, string>,
    defaultConnections: Record<string, string>
  ): void {
    this.registeredTypes = types;
    this.typeDisplayNames = displayNames;
    this.defaultConnections = defaultConnections;
    this.refresh();
  }

  private displayName(typeName: string): string {
    return this.typeDisplayNames[typeName] ?? typeName;
  }

  dispose(): void {
    this.watcher?.dispose();
    this.editorWatcher?.dispose();
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

    // 1. Config file section — the one config that applies to the active file
    if (this.dirty) {
      await this.resolveActiveConfigFile();
      this.dirty = false;
    }

    const configNames = new Set<string>();
    if (this.activeConfigFile) {
      const configFile = this.activeConfigFile;
      const children = Object.entries(configFile.connections).map(
        ([name, entry]) => {
          configNames.add(name);
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
        const shadowed = configNames.has(name);
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

    // 3. Defaults section — from getDefaultConnections()
    const settingsNames = new Set(
      settingsConfig ? Object.keys(settingsConfig) : []
    );
    const defaultChildren = Object.entries(this.defaultConnections)
      .filter(([name]) => !configNames.has(name) && !settingsNames.has(name))
      .map(([name, typeName]) =>
        ConnectionItem.defaultConnection(name, this.displayName(typeName))
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

  /**
   * Resolve the single config file that applies to the active editor's file.
   * Mirrors the logic in NodeConnectionFactory.findMalloyConfig:
   * 1. Walk up from the file's directory to the workspace root
   * 2. Return the first malloy-config.json found
   * 3. Fall back to the global config directory
   */
  private async resolveActiveConfigFile(): Promise<void> {
    this.activeConfigFile = undefined;

    // Walk up from file directory to workspace root looking for config
    if (this.activeFileUri) {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(
        this.activeFileUri
      );
      if (workspaceFolder) {
        // Walk from file's parent directory up to (and including) workspace root
        const rootPath = workspaceFolder.uri.path;
        let dir = vscode.Uri.joinPath(this.activeFileUri, '..');
        for (;;) {
          const configUri = vscode.Uri.joinPath(dir, 'malloy-config.json');
          if (await this.loadConfigFile(configUri)) {
            return;
          }
          if (dir.path === rootPath) break;
          const parent = vscode.Uri.joinPath(dir, '..');
          if (parent.path === dir.path) break; // filesystem root
          dir = parent;
        }
      }
    }

    // Fall back to global config directory
    const projectOnly =
      getMalloyConfig().get<boolean>('projectConnectionsOnly') ?? false;
    if (!projectOnly) {
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
  ): Promise<boolean> {
    try {
      const content = await vscode.workspace.fs.readFile(fileUri);
      const text = new TextDecoder().decode(content);
      const parsed = new MalloyConfig(text);
      const relativePath =
        labelOverride ?? vscode.workspace.asRelativePath(fileUri, true);
      this.activeConfigFile = {
        uri: fileUri,
        relativePath,
        connections: parsed.connectionMap ?? {},
      };
      return true;
    } catch {
      return false;
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
  public readonly configFileUri?: string;

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
    if (contextValue === 'connectionGroup.config' && uriKey) {
      this.configFileUri = uriKey;
    }
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

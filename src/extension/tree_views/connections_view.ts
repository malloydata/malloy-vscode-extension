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
import {ConnectionConfigEntry} from '@malloydata/malloy';

import {ConnectionConfigManager} from '../../common/types/connection_manager_types';

export type ConnectionTreeItem = ConnectionGroupItem | ConnectionItem;

/** Callback the sidebar uses to ask the runtime which config applies. */
export type ConfigSourceResolver = (fileUri: string) => Promise<{
  source: 'discovered' | 'global' | 'defaults';
  configFileUri?: string;
}>;

interface ConfigFileInfo {
  uri: vscode.Uri;
  relativePath: string;
  connections: Record<string, ConnectionConfigEntry>;
}

export class ConnectionsProvider
  implements vscode.TreeDataProvider<ConnectionTreeItem>, vscode.Disposable
{
  private activeConfigFile: ConfigFileInfo | undefined;
  private activeConfigSource: 'discovered' | 'global' | 'defaults' = 'defaults';
  private watcher: vscode.Disposable | undefined;
  private editorWatcher: vscode.Disposable | undefined;
  private notebookEditorWatcher: vscode.Disposable | undefined;
  private dirty = true;
  private registeredTypes: string[] = [];
  private typeDisplayNames: Record<string, string> = {};
  /** Maps default connection name → registered type name. */
  private defaultConnections: Record<string, string> = {};
  private activeFileUri: vscode.Uri | undefined;
  private configSourceResolver: ConfigSourceResolver | undefined;

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
    this.notebookEditorWatcher = vscode.window.onDidChangeActiveNotebookEditor(
      editor => {
        const newUri = editor?.notebook.uri;
        if (newUri?.toString() !== this.activeFileUri?.toString()) {
          this.activeFileUri = newUri;
          this.refresh();
        }
      }
    );
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

  /**
   * Inject the resolver that asks the language server which config applies
   * to a given file. Called after the LSP client is ready.
   */
  setConfigSourceResolver(resolver: ConfigSourceResolver): void {
    this.configSourceResolver = resolver;
    this.refresh();
  }

  private displayName(typeName: string): string {
    return this.typeDisplayNames[typeName] ?? typeName;
  }

  dispose(): void {
    this.watcher?.dispose();
    this.editorWatcher?.dispose();
    this.notebookEditorWatcher?.dispose();
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

    // 1. Resolve which config applies to the active file
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

    // When a config file is authoritative (discovered or global),
    // Settings and Defaults don't apply — don't show them.
    const configIsAuthoritative =
      this.activeConfigSource === 'discovered' ||
      this.activeConfigSource === 'global';

    if (!configIsAuthoritative) {
      // 2. Settings section
      const settingsConfig =
        this.connectionConfigManager.getConnectionsConfig();
      if (settingsConfig) {
        const children = Object.entries(settingsConfig).map(([name, entry]) => {
          return ConnectionItem.settings(name, this.displayName(entry.is));
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

      // 3. Defaults section
      const settingsNames = new Set(
        settingsConfig ? Object.keys(settingsConfig) : []
      );
      const defaultChildren = Object.entries(this.defaultConnections)
        .filter(([name]) => !settingsNames.has(name))
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
    }

    return groups;
  }

  /**
   * Resolve the config that applies to the active editor's file by asking
   * the language server (via configSourceResolver). Falls back to no-config
   * if the resolver is unavailable or the file is unknown.
   */
  private async resolveActiveConfigFile(): Promise<void> {
    this.activeConfigFile = undefined;
    this.activeConfigSource = 'defaults';

    if (!this.activeFileUri || !this.configSourceResolver) return;

    try {
      // Notebook cells have scheme vscode-notebook-cell: — normalize to
      // the notebook's file: URI so config discovery works correctly.
      let fileUri = this.activeFileUri;
      if (fileUri.scheme === 'vscode-notebook-cell') {
        const scheme =
          vscode.workspace.workspaceFolders?.[0]?.uri.scheme ?? 'file';
        fileUri = vscode.Uri.from({
          scheme,
          authority: fileUri.authority,
          path: fileUri.path,
          query: fileUri.query,
        });
      }
      const result = await this.configSourceResolver(fileUri.toString());
      this.activeConfigSource = result.source;

      if (result.configFileUri) {
        const configUri = vscode.Uri.parse(result.configFileUri);
        const label =
          result.source === 'global'
            ? 'global'
            : vscode.workspace.asRelativePath(configUri, true);
        await this.loadConfigFile(configUri, label, result.source);
      }
    } catch {
      // Resolver not ready or failed — show defaults
    }
  }

  private async loadConfigFile(
    fileUri: vscode.Uri,
    labelOverride?: string,
    source?: 'discovered' | 'global' | 'defaults'
  ): Promise<boolean> {
    try {
      const content = await vscode.workspace.fs.readFile(fileUri);
      const text = new TextDecoder().decode(content);
      const parsed = JSON.parse(text);
      const connections: Record<string, ConnectionConfigEntry> =
        parsed?.connections ?? {};

      // Merge malloy-config-local.json only for discovered configs —
      // runtime does not merge local into the global fallback.
      if (source === 'discovered') {
        const dirUri = vscode.Uri.joinPath(fileUri, '..');
        const localUri = vscode.Uri.joinPath(
          dirUri,
          'malloy-config-local.json'
        );
        try {
          const localContent = await vscode.workspace.fs.readFile(localUri);
          const localText = new TextDecoder().decode(localContent);
          const localParsed = JSON.parse(localText);
          const localConns: Record<string, ConnectionConfigEntry> =
            localParsed?.connections ?? {};
          Object.assign(connections, localConns);
        } catch {
          // No local config — that's fine
        }
      }

      const relativePath =
        labelOverride ?? vscode.workspace.asRelativePath(fileUri, true);
      this.activeConfigFile = {
        uri: fileUri,
        relativePath,
        connections,
      };
      return true;
    } catch {
      return false;
    }
  }

  private setupWatcher(): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher(
      '**/malloy-config{,-local}.json'
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

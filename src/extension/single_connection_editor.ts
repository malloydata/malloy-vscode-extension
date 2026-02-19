/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import {v1 as uuid} from 'uuid';
import {getWebviewHtml} from './webviews/webview_html';
import {
  ConnectionServiceFileRequestStatus,
  ConnectionTestStatus,
  SingleConnectionMessage,
  SingleConnectionMessageType,
} from '../common/types/message_types';
import {WebviewMessageManager} from './webview_message_manager';
import {UnresolvedConnectionConfigEntry} from '../common/types/connection_manager_types';
import {isSecretKeyReference} from '../common/connection_manager';
import {getMalloyConfig} from './utils/config';
import {WorkerConnection} from './worker_connection';
import {errorMessage} from '../common/errors';
import {
  ConnectionConfigEntry,
  isValueRef,
  resolveValue,
} from '@malloydata/malloy';
import {ConnectionTypeInfoResponse} from '../common/types/worker_message_types';

export class SingleConnectionPanel {
  private panel: vscode.WebviewPanel | undefined;
  private messageManager:
    | WebviewMessageManager<SingleConnectionMessage>
    | undefined;
  private currentUuid: string | undefined;
  private currentName: string | undefined;
  private currentTypeName: string | undefined;
  private disposables: vscode.Disposable[] = [];
  private onDisposeCallback: (() => void) | undefined;
  private typeInfoCache: ConnectionTypeInfoResponse | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private worker: WorkerConnection
  ) {}

  private async getTypeInfo(): Promise<ConnectionTypeInfoResponse> {
    if (!this.typeInfoCache) {
      this.typeInfoCache = await this.worker.sendRequest(
        'malloy/getConnectionTypeInfo',
        {}
      );
    }
    return this.typeInfoCache;
  }

  private displayName(
    typeInfo: ConnectionTypeInfoResponse,
    typeName: string
  ): string {
    return typeInfo.typeDisplayNames[typeName] ?? typeName;
  }

  private ensurePanel(): {
    panel: vscode.WebviewPanel;
    messages: WebviewMessageManager<SingleConnectionMessage>;
  } {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'malloyConnectionEditor',
        'Edit Connection',
        vscode.ViewColumn.One,
        {enableScripts: true, retainContextWhenHidden: true}
      );
      this.panel.onDidDispose(
        () => {
          this.panel = undefined;
          this.messageManager = undefined;
          this.disposables.forEach(d => d.dispose());
          this.disposables = [];
          this.onDisposeCallback?.();
        },
        null,
        this.disposables
      );

      this.panel.webview.html = getWebviewHtml(
        this.context.extensionUri,
        'connection_editor_page',
        this.panel.webview
      );

      this.messageManager = new WebviewMessageManager<SingleConnectionMessage>(
        this.panel
      );

      this.messageManager.onReceiveMessage(message => {
        this.handleMessage(message).catch(error => {
          console.error('Connection editor message handling failed:', error);
        });
      });
    }
    return {panel: this.panel, messages: this.messageManager!};
  }

  async editConnection(name: string): Promise<void> {
    const {panel, messages} = this.ensurePanel();
    panel.title = `Edit Connection: ${name}`;
    panel.reveal();

    const connectionMap = this.getConnectionMap();
    const entry = connectionMap[name];
    if (!entry) {
      void vscode.window.showErrorMessage(
        `Connection "${name}" not found in settings.`
      );
      return;
    }

    // Find the UUID for this connection (stored as metadata in the entry)
    // or look it up from the legacy secret key pattern
    this.currentUuid = this.findUuidForConnection(entry);
    this.currentName = name;
    this.currentTypeName = entry.is;

    const typeName = entry.is;
    const typeInfo = await this.getTypeInfo();
    const properties = typeInfo.typeProperties[typeName] ?? [];

    // Resolve secret values from keychain
    const values: Record<string, string | number | boolean> = {};
    for (const prop of properties) {
      const rawValue = entry[prop.name];
      if (isSecretKeyReference(rawValue)) {
        const secret = await this.context.secrets.get(rawValue.secretKey);
        if (secret !== undefined) {
          values[prop.name] = secret;
        }
      } else if (rawValue !== undefined && typeof rawValue !== 'object') {
        values[prop.name] = rawValue;
      }
    }

    const existingNames = Object.keys(connectionMap).filter(n => n !== name);

    messages.postMessage({
      type: SingleConnectionMessageType.LoadConnection,
      name,
      uuid: this.currentUuid,
      typeName,
      typeDisplayName: this.displayName(typeInfo, typeName),
      properties,
      values,
      existingNames,
      registeredTypes: typeInfo.registeredTypes,
      isNew: false,
    });
  }

  async createConnection(typeName: string): Promise<void> {
    const {panel, messages} = this.ensurePanel();
    const typeInfo = await this.getTypeInfo();
    panel.title = `New Connection: ${this.displayName(typeInfo, typeName)}`;
    panel.reveal();

    this.currentUuid = uuid();
    this.currentName = undefined;
    this.currentTypeName = typeName;

    const properties = typeInfo.typeProperties[typeName] ?? [];
    const connectionMap = this.getConnectionMap();
    const existingNames = Object.keys(connectionMap);

    messages.postMessage({
      type: SingleConnectionMessageType.LoadConnection,
      name: typeName,
      uuid: this.currentUuid,
      typeName,
      typeDisplayName: this.displayName(typeInfo, typeName),
      properties,
      values: {},
      existingNames,
      registeredTypes: typeInfo.registeredTypes,
      isNew: true,
    });
  }

  async viewConfigConnection(
    name: string,
    entry: ConnectionConfigEntry,
    _configFileUri: string
  ): Promise<void> {
    const {panel, messages} = this.ensurePanel();
    panel.title = `View Connection: ${name}`;
    panel.reveal();

    this.currentUuid = undefined;
    this.currentName = name;
    this.currentTypeName = entry.is;

    const typeInfo = await this.getTypeInfo();
    const properties = typeInfo.typeProperties[entry.is] ?? [];

    // Build values from the entry — resolve {env: "VAR"} references
    const values: Record<string, string | number | boolean> = {};
    for (const prop of properties) {
      const rawValue = entry[prop.name];
      if (rawValue === undefined) continue;
      if (isValueRef(rawValue)) {
        const resolved = resolveValue(rawValue);
        if (resolved !== undefined) {
          values[prop.name] = resolved;
        }
      } else if (typeof rawValue !== 'object') {
        values[prop.name] = rawValue;
      }
    }

    messages.postMessage({
      type: SingleConnectionMessageType.LoadConnection,
      name,
      uuid: '',
      typeName: entry.is,
      typeDisplayName: this.displayName(typeInfo, entry.is),
      properties,
      values,
      existingNames: [],
      registeredTypes: typeInfo.registeredTypes,
      isNew: false,
      readonly: true,
    });
  }

  onDispose(callback: () => void): void {
    this.onDisposeCallback = callback;
  }

  reveal(): void {
    this.panel?.reveal();
  }

  private async handleMessage(message: SingleConnectionMessage): Promise<void> {
    switch (message.type) {
      case SingleConnectionMessageType.SaveConnection:
        await this.handleSave(
          message.originalName,
          message.name,
          message.values
        );
        break;
      case SingleConnectionMessageType.DeleteConnection:
        await this.handleDelete(message.name);
        break;
      case SingleConnectionMessageType.TestConnection:
        if (message.status === ConnectionTestStatus.Waiting) {
          await this.handleTest(message.name, message.values);
        }
        break;
      case SingleConnectionMessageType.RequestFile:
        if (message.status === ConnectionServiceFileRequestStatus.Waiting) {
          await this.handleFileRequest(message.propName, message.filters);
        }
        break;
      case SingleConnectionMessageType.CancelConnection:
        this.panel?.dispose();
        break;
      case SingleConnectionMessageType.DuplicateConnection:
        await this.handleDuplicate(message.name, message.values);
        break;
    }
  }

  private async handleSave(
    originalName: string,
    name: string,
    values: Record<string, string | number | boolean>
  ): Promise<void> {
    if (!this.currentUuid) return;

    const connectionMap = this.getConnectionMap();
    const typeName = originalName ? connectionMap[originalName]?.is : undefined;

    // Get the type from the current connection or from the LoadConnection state
    const is = typeName ?? connectionMap[name]?.is ?? this.currentTypeName;
    if (!is) return;

    const typeInfo = await this.getTypeInfo();
    const properties = typeInfo.typeProperties[is] ?? [];
    const entry: UnresolvedConnectionConfigEntry = {is};

    for (const prop of properties) {
      const value = values[prop.name];
      if (value === undefined || value === '') continue;

      if (prop.type === 'password' || prop.type === 'secret') {
        // Store in keychain, save reference
        const secretKey = `connections.${this.currentUuid}.${prop.name}`;
        await this.context.secrets.store(secretKey, String(value));
        entry[prop.name] = {secretKey};
      } else {
        entry[prop.name] = value;
      }
    }

    // Remove old entry if renamed
    if (originalName && originalName !== name) {
      delete connectionMap[originalName];
    }
    connectionMap[name] = entry;

    await this.writeConnectionMap(connectionMap);
    this.currentName = name;
    if (this.panel) {
      this.panel.title = `Edit Connection: ${name}`;
    }
  }

  private async handleDelete(name: string): Promise<void> {
    const connectionMap = this.getConnectionMap();
    const entry = connectionMap[name];

    // Delete keychain entries for this connection
    if (entry && this.currentUuid) {
      const typeInfo = await this.getTypeInfo();
      const properties = typeInfo.typeProperties[entry.is] ?? [];
      for (const prop of properties) {
        if (prop.type === 'password' || prop.type === 'secret') {
          const secretKey = `connections.${this.currentUuid}.${prop.name}`;
          await this.context.secrets.delete(secretKey);
        }
      }
    }

    delete connectionMap[name];
    await this.writeConnectionMap(connectionMap);
    this.panel?.dispose();
  }

  private async handleTest(
    name: string,
    values: Record<string, string | number | boolean>
  ): Promise<void> {
    if (!this.messageManager) return;

    // Build a ConnectionConfigEntry from the values
    const connectionMap = this.getConnectionMap();
    const is =
      (this.currentName ? connectionMap[this.currentName]?.is : undefined) ??
      this.currentTypeName;
    if (!is) return;

    const entry: ConnectionConfigEntry = {is};
    const typeInfo = await this.getTypeInfo();
    const properties = typeInfo.typeProperties[is] ?? [];
    for (const prop of properties) {
      const value = values[prop.name];
      if (value !== undefined && value !== '') {
        entry[prop.name] = value;
      }
    }

    try {
      const result: string = await this.worker.sendRequest(
        'malloy/testConnectionEntry',
        {name: name || 'test', entry}
      );
      if (result) {
        throw new Error(result);
      }
      this.messageManager.postMessage({
        type: SingleConnectionMessageType.TestConnection,
        status: ConnectionTestStatus.Success,
      });
    } catch (error) {
      this.messageManager.postMessage({
        type: SingleConnectionMessageType.TestConnection,
        status: ConnectionTestStatus.Error,
        error: errorMessage(error),
      });
    }
  }

  private async handleDuplicate(
    name: string,
    values: Record<string, string | number | boolean>
  ): Promise<void> {
    if (!this.currentTypeName || !this.messageManager) return;

    const typeName = this.currentTypeName;
    const typeInfo = await this.getTypeInfo();
    const properties = typeInfo.typeProperties[typeName] ?? [];
    const connectionMap = this.getConnectionMap();
    const existingNames = Object.keys(connectionMap);

    // Generate a unique copy name
    let copyName = `${name}_copy`;
    let i = 2;
    while (existingNames.includes(copyName)) {
      copyName = `${name}_copy_${i}`;
      i++;
    }

    this.currentUuid = uuid();
    this.currentName = undefined;

    if (this.panel) {
      this.panel.title = `New Connection: ${this.displayName(
        typeInfo,
        typeName
      )}`;
    }

    this.messageManager.postMessage({
      type: SingleConnectionMessageType.LoadConnection,
      name: copyName,
      uuid: this.currentUuid,
      typeName,
      typeDisplayName: this.displayName(typeInfo, typeName),
      properties,
      values,
      existingNames,
      registeredTypes: typeInfo.registeredTypes,
      isNew: true,
    });
  }

  private async handleFileRequest(
    propName: string,
    filters: Record<string, string[]>
  ): Promise<void> {
    if (!this.messageManager) return;

    const result = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters,
    });
    if (result) {
      this.messageManager.postMessage({
        type: SingleConnectionMessageType.RequestFile,
        status: ConnectionServiceFileRequestStatus.Success,
        propName,
        fsPath: result[0].fsPath,
      });
    }
  }

  private getConnectionMap(): Record<string, UnresolvedConnectionConfigEntry> {
    const malloyConfig = getMalloyConfig();
    const connectionMap = malloyConfig.get('connectionMap');
    if (connectionMap && typeof connectionMap === 'object') {
      return {
        ...(connectionMap as Record<string, UnresolvedConnectionConfigEntry>),
      };
    }
    return {};
  }

  private async writeConnectionMap(
    connectionMap: Record<string, UnresolvedConnectionConfigEntry>
  ): Promise<void> {
    const malloyConfig = getMalloyConfig();
    await malloyConfig.update(
      'connectionMap',
      connectionMap,
      vscode.ConfigurationTarget.Global
    );
  }

  private findUuidForConnection(
    entry: UnresolvedConnectionConfigEntry
  ): string {
    // Look for an existing secretKey reference to extract the UUID
    for (const value of Object.values(entry)) {
      if (isSecretKeyReference(value)) {
        // Pattern: connections.<uuid>.<field>
        const parts = value.secretKey.split('.');
        if (parts.length === 3 && parts[0] === 'connections') {
          return parts[1];
        }
      }
    }
    // No existing secret references — generate a new UUID
    return uuid();
  }

  dispose(): void {
    this.panel?.dispose();
  }
}

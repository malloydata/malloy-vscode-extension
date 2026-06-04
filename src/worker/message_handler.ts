/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  getRegisteredConnectionTypes,
  getConnectionProperties,
  getConnectionTypeDisplayName,
} from '@malloydata/malloy';
import {ConnectionPropertyInfo} from '../common/types/message_types';
import {runQuery} from './run_query';
import {testConnectionEntry} from './test_connection';
import {
  GenericConnection,
  ListenerType,
  WorkerMessageHandler,
  MessageMap,
  WorkerMessageMap,
  WorkerMessageResponseMap,
} from '../common/types/worker_message_types';
import {ConnectionManager} from '../common/types/connection_manager_types';
import {RpcFileHandler} from './file_handler';
import {FileHandler} from '../common/types/file_handler';
import {ProgressType} from 'vscode-jsonrpc';
import {errorMessage} from '../common/errors';
import {CommonConnectionManager} from '../common/connection_manager';
import {compileQuery} from './compile_query';

export class MessageHandler implements WorkerMessageHandler {
  public fileHandler: FileHandler;
  constructor(
    private connection: GenericConnection,
    connectionManager: ConnectionManager,
    isBrowser = false
  ) {
    this.fileHandler = new RpcFileHandler(this);

    // Wire URLReader so the connection manager can use discoverConfig
    if (connectionManager instanceof CommonConnectionManager) {
      connectionManager.setURLReader(this.fileHandler);
    }

    this.onRequest('malloy/compile', ({documentMeta, query}) =>
      compileQuery(this.fileHandler, connectionManager, documentMeta, query)
    );

    this.onRequest('malloy/run', (message, cancellationToken) =>
      runQuery(
        this,
        this.fileHandler,
        connectionManager,
        isBrowser,
        message,
        cancellationToken
      )
    );

    this.onRequest('malloy/testConnectionEntry', async message => {
      try {
        await testConnectionEntry(message.name, message.entry);
      } catch (error) {
        return errorMessage(error);
      }
      return '';
    });

    this.onRequest('malloy/invalidateConnectionCache', async () => {
      if (connectionManager instanceof CommonConnectionManager) {
        connectionManager.notifyConfigFileChanged();
      }
    });

    this.onRequest('malloy/getConnectionTypeInfo', async () => {
      const types = getRegisteredConnectionTypes();
      const typeDisplayNames: Record<string, string> = {};
      const typeProperties: Record<string, ConnectionPropertyInfo[]> = {};
      for (const typeName of types) {
        typeDisplayNames[typeName] =
          getConnectionTypeDisplayName(typeName) ?? typeName;
        const props = getConnectionProperties(typeName) ?? [];
        typeProperties[typeName] = props.map(p => ({
          name: p.name,
          displayName: p.displayName,
          type: p.type,
          optional: p.optional,
          default: p.default,
          description: p.description,
          fileFilters: p.fileFilters,
          advanced: p.advanced,
        }));
      }
      const defaultConnections =
        connectionManager instanceof CommonConnectionManager
          ? connectionManager.getDefaultConnectionTypes()
          : {};
      return {
        registeredTypes: types,
        typeDisplayNames,
        typeProperties,
        defaultConnections,
      };
    });
  }

  onRequest<K extends keyof MessageMap>(
    type: K,
    message: ListenerType<MessageMap[K]>
  ) {
    return this.connection.onRequest(type, message);
  }

  sendRequest<K extends keyof WorkerMessageMap>(
    type: K,
    message: WorkerMessageMap[K]
  ): Promise<WorkerMessageResponseMap[K]> {
    return this.connection.sendRequest(type, message);
  }

  sendProgress<P>(
    type: ProgressType<P>,
    token: string | number,
    value: P
  ): Promise<void> {
    return this.connection.sendProgress(type, token, value);
  }

  log(message: string) {
    const maybeConnection = this.connection as unknown as {
      console?: {info: (msg: string) => void};
    };
    if (maybeConnection.console?.info) {
      maybeConnection.console.info(message);
    } else {
      console.info(message);
    }
  }
}

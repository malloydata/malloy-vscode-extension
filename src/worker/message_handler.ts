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
import {compileQuery} from './compile_query';

export class MessageHandler implements WorkerMessageHandler {
  public fileHandler: FileHandler;
  constructor(
    private connection: GenericConnection,
    connectionManager: ConnectionManager,
    isBrowser = false
  ) {
    this.fileHandler = new RpcFileHandler(this);

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
        }));
      }
      return {registeredTypes: types, typeDisplayNames, typeProperties};
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
    console.info(message);
  }
}

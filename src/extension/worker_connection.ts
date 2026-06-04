/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import {
  GenericConnection,
  ListenerType,
  MessageMap,
  WorkerMessageMap,
  WorkerFetchBinaryMessage,
  WorkerFetchCellDataMessage,
  WorkerFetchMessage,
  ExtensionMessageHandler,
  MessageResponseMap,
} from '../common/types/worker_message_types';
import {FileHandler} from '../common/types/file_handler';
import {Disposable, NotificationHandler, ProgressType} from 'vscode-jsonrpc';
import {logPrefix} from '../common/log';

const workerLog = vscode.window.createOutputChannel('Malloy Worker');
export abstract class WorkerConnection implements ExtensionMessageHandler {
  constructor(
    private context: vscode.ExtensionContext,
    private fileHandler: FileHandler
  ) {}

  abstract get connection(): GenericConnection;

  subscribe() {
    this.context.subscriptions.push(
      this.onRequest('malloy/fetch', async ({uri}: WorkerFetchMessage) => {
        workerLog.appendLine(`${logPrefix('Debug')} reading file ${uri}`);
        return await this.fileHandler.fetchFile(uri);
      })
    );

    this.context.subscriptions.push(
      this.onRequest(
        'malloy/fetchBinary',
        async ({uri}: WorkerFetchBinaryMessage) => {
          workerLog.appendLine(
            `${logPrefix('Debug')} reading binary file ${uri}`
          );
          return await this.fileHandler.fetchBinaryFile(uri);
        }
      )
    );

    this.context.subscriptions.push(
      this.onRequest(
        'malloy/fetchCellData',
        async ({uri}: WorkerFetchCellDataMessage) => {
          workerLog.appendLine(
            `${logPrefix('Debug')} reading cell data for ${uri}`
          );
          return await this.fileHandler.fetchCellData(uri);
        }
      )
    );

    this.context.subscriptions.push(
      this.onRequest(
        'malloy/fetchWorkspaceFolders',
        async ({uri}: WorkerFetchCellDataMessage) => {
          workerLog.appendLine(
            `${logPrefix('Debug')} reading cell data for ${uri}`
          );
          return await this.fileHandler.fetchWorkspaceFolders(uri);
        }
      )
    );

    this.context.subscriptions.push(this);
  }

  sendRequest<K extends keyof MessageMap>(
    type: K,
    message: MessageMap[K],
    cancellationToken?: vscode.CancellationToken | undefined
  ): Promise<MessageResponseMap[K]> {
    return this.connection.sendRequest(type, message, cancellationToken);
  }

  onRequest<K extends keyof WorkerMessageMap>(
    event: K,
    listener: ListenerType<WorkerMessageMap[K]>
  ): vscode.Disposable {
    return this.connection.onRequest(event, listener);
  }

  sendProgress<P>(
    type: ProgressType<P>,
    token: string | number,
    value: P
  ): Promise<void> {
    return this.connection.sendProgress(type, token, value);
  }

  onProgress<P>(
    type: ProgressType<P>,
    token: string | number,
    handler: NotificationHandler<P>
  ): Disposable {
    return this.connection.onProgress(type, token, handler);
  }

  abstract dispose(): void;
}

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
  CancellationToken,
  Disposable,
  GenericRequestHandler,
  NotificationHandler,
  ProgressType,
} from 'vscode-jsonrpc';
import {QueryDownloadOptions} from './message_types';
import {CellData} from './file_handler';
import {QuerySpec} from './query_spec';
import {ConnectionConfig} from './connection_manager_types';

/*
 * Incoming messages
 */

export interface MessageRun {
  query: QuerySpec;
  panelId: string;
  name: string;
  showSQLOnly: boolean;
  showSchemaOnly: boolean;
  defaultTab?: string;
}

export interface MessageFetch {
  id: string;
  uri: string;
  data?: string;
  error?: string;
}

export interface MessageFetchBinary {
  id: string;
  uri: string;
  data?: Uint8Array;
  error?: string;
}

export interface MessageFetchCellData {
  id: string;
  uri: string;
  data?: CellData;
  error?: string;
}

export interface MessageDownload {
  query: QuerySpec;
  panelId: string;
  downloadUri: string;
  downloadOptions: QueryDownloadOptions;
}

export interface MessageRefreshSchemaCache {
  uri: string;
}

export interface MessageTest {
  config: ConnectionConfig;
}

export interface MessageFetchWorkspaceFolders {
  workspaceFolders: string[];
}

export type FetchMessage =
  | MessageFetch
  | MessageFetchBinary
  | MessageFetchCellData
  | MessageFetchWorkspaceFolders;

/**
 * Type map of extension message types to message interfaces.
 */
export interface MessageMap {
  'malloy/fetch': MessageFetch;
  'malloy/fetchBinary': MessageFetchBinary;
  'malloy/fetchCellData': MessageFetchCellData;
  'malloy/fetchWorkspaceFolders': MessageFetchCellData;
  'malloy/run': MessageRun;
  'malloy/download': MessageDownload;
  'malloy/testConnection': MessageTest;
}

/**
 * Outgoing messages
 */

export interface WorkerDownloadMessage {
  name: string;
  error?: string;
}

export interface WorkerLogMessage {
  message: string;
}

export interface WorkerFetchBinaryMessage {
  uri: string;
}

export interface WorkerFetchCellDataMessage {
  uri: string;
}

export interface WorkerFetchMessage {
  uri: string;
}

export interface WorkerFetchWorkspaceFoldersMessage {
  uri: string;
}

/**
 * Map of worker message types to worker message interfaces.
 */
export interface WorkerMessageMap {
  'malloy/download': WorkerDownloadMessage;
  'malloy/fetchBinary': WorkerFetchBinaryMessage;
  'malloy/fetch': WorkerFetchMessage;
  'malloy/fetchCellData': WorkerFetchCellDataMessage;
  'malloy/fetchWorkspaceFolders': WorkerFetchWorkspaceFoldersMessage;
}

/**
 * Worker side message handler interface. Enforces message directionality.
 */
export interface WorkerMessageHandler {
  onRequest<K extends keyof MessageMap>(
    type: K,
    message: ListenerType<MessageMap[K]>
  ): Disposable;

  sendProgress<P>(
    type: ProgressType<P>,
    token: string | number,
    value: P
  ): Promise<void>;

  sendRequest<R, K extends keyof WorkerMessageMap>(
    type: K,
    message: WorkerMessageMap[K]
  ): Promise<R>;

  log(message: string): void;
}

/**
 * Extension side message handler interface. Enforces message directionality.
 */
export interface ExtensionMessageHandler {
  onRequest<K extends keyof WorkerMessageMap>(
    type: K,
    message: ListenerType<WorkerMessageMap[K]>
  ): Disposable;

  sendRequest<R, K extends keyof MessageMap>(
    type: K,
    message: MessageMap[K]
  ): Promise<R>;
}

/**
 * Abstraction for the two different types of connections we
 * deal with, the vscode-language-server ClientConnection, and the the
 * vscode-json-rpc Message connection.
 */
export interface GenericConnection {
  onRequest<R, E>(
    method: string,
    handler: GenericRequestHandler<R, E>
  ): Disposable;

  onProgress<P>(
    type: ProgressType<P>,
    token: string | number,
    handler: NotificationHandler<P>
  ): Disposable;

  sendRequest<R>(
    method: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    param: any,
    token?: CancellationToken
  ): Promise<R>;

  sendProgress<P>(
    type: ProgressType<P>,
    token: string | number,
    value: P
  ): Promise<void>;
}

export type ListenerType<K> = (
  message: K,
  cancellationToken: CancellationToken
) => void;

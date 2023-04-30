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

import {Disposable} from 'vscode-jsonrpc';
import {
  QueryDownloadOptions,
  QueryPanelMessage,
  SQLQueryPanelMessage,
} from './message_types';
import {CellData, MalloyConfig} from './types';

interface NamedQuerySpec {
  type: 'named';
  name: string;
  uri: string;
}

interface QueryStringSpec {
  type: 'string';
  text: string;
  uri: string;
}

interface QueryFileSpec {
  type: 'file';
  index: number;
  uri: string;
}

interface NamedSQLQuerySpec {
  type: 'named_sql';
  name: string;
  uri: string;
}

interface UnnamedSQLQuerySpec {
  type: 'unnamed_sql';
  index: number;
  uri: string;
}

export type WorkerQuerySpec =
  | NamedQuerySpec
  | QueryStringSpec
  | QueryFileSpec
  | NamedSQLQuerySpec
  | UnnamedSQLQuerySpec;

/*
 * Incoming messages
 */

export interface MessageExit {
  type: 'exit';
}

export interface MessageRun {
  type: 'malloy/run';
  query: WorkerQuerySpec;
  panelId: string;
  name: string;
  showSQLOnly: boolean;
}

export interface MessageRunMalloySQL {
  type: 'malloy/run-malloy-sql';
  panelId: string;
  query: string;
  connectionName: string;
  source?: string;
  showSQLOnly?: boolean;
}

export interface MessageCancel {
  type: 'malloy/cancel';
  panelId: string;
}

export interface MessageConfig {
  type: 'malloy/config';
  config: MalloyConfig;
}

export interface MessageFetch {
  type: 'malloy/fetch';
  id: string;
  uri: string;
  data?: string;
  error?: string;
}

export interface MessageFetchBinary {
  type: 'malloy/fetchBinary';
  id: string;
  uri: string;
  data?: Uint8Array;
  error?: string;
}

export interface MessageFetchCellData {
  type: 'malloy/fetchCellData';
  id: string;
  uri: string;
  data?: CellData[];
  error?: string;
}

export interface MessageDownload {
  type: 'malloy/download';
  query: WorkerQuerySpec;
  panelId: string;
  name: string;
  uri: string;
  downloadOptions: QueryDownloadOptions;
}

export type FetchMessage =
  | MessageFetch
  | MessageFetchBinary
  | MessageFetchCellData;

export type Message =
  | MessageCancel
  | MessageConfig
  | MessageExit
  | MessageFetch
  | MessageFetchBinary
  | MessageFetchCellData
  | MessageRun
  | MessageDownload
  | MessageRunMalloySQL;

/**
 * Outgoing messages
 */

export interface WorkerDeadMessage {
  type: 'malloy/dead';
}

export interface WorkerDownloadMessage {
  type: 'malloy/download';
  name: string;
  error?: string;
}

export interface WorkerLogMessage {
  type: 'malloy/log';
  message: string;
}

export interface WorkerQueryPanelMessage {
  type: 'malloy/queryPanel';
  panelId: string;
  message: QueryPanelMessage;
}

export interface WorkerSQLQueryPanelMessage {
  type: 'malloy/SQLQueryPanel';
  panelId: string;
  message: SQLQueryPanelMessage;
}

export interface WorkerStartMessage {
  type: 'malloy/start';
}

export interface WorkerReadBinaryMessage {
  type: 'malloy/fetchBinary';
  id: string;
  uri: string;
}

export interface WorkerReadCellDataMessage {
  type: 'malloy/fetchCellData';
  id: string;
  uri: string;
}

export interface WorkerReadMessage {
  type: 'malloy/fetch';
  id: string;
  uri: string;
}

export type WorkerMessage =
  | WorkerDeadMessage
  | WorkerDownloadMessage
  | WorkerLogMessage
  | WorkerQueryPanelMessage
  | WorkerReadBinaryMessage
  | WorkerReadMessage
  | WorkerReadCellDataMessage
  | WorkerStartMessage
  | WorkerSQLQueryPanelMessage;

export interface BaseWorker {
  send(message: Message): void;
  on(
    name: WorkerMessage['type'],
    callback: (message: WorkerMessage) => void
  ): Disposable;
}

export interface MessageHandler {
  send(message: WorkerMessage): void;
  log(message: string): void;
}

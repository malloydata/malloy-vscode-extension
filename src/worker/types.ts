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
  QueryDownloadOptions,
  QueryPanelMessage,
} from '../extension/message_types';
import {CellData, MalloyConfig} from '../extension/types';

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
  type: 'run';
  query: WorkerQuerySpec;
  panelId: string;
  name: string;
}

export interface MessageCancel {
  type: 'cancel';
  panelId: string;
}

export interface MessageConfig {
  type: 'config';
  config: MalloyConfig;
}

export interface MessageRead {
  type: 'read';
  id: string;
  uri: string;
  data?: string;
  error?: string;
}

export interface MessageReadBinary {
  type: 'read_binary';
  id: string;
  uri: string;
  data?: Uint8Array;
  error?: string;
}

export interface MessageReadCellData {
  type: 'read_cell_data';
  id: string;
  uri: string;
  data?: CellData[];
  error?: string;
}

export interface MessageDownload {
  type: 'download';
  query: WorkerQuerySpec;
  panelId: string;
  name: string;
  uri: string;
  downloadOptions: QueryDownloadOptions;
}

export type FetchMessage =
  | MessageRead
  | MessageReadBinary
  | MessageReadCellData;

export type Message =
  | MessageCancel
  | MessageConfig
  | MessageExit
  | MessageRead
  | MessageReadBinary
  | MessageReadCellData
  | MessageRun
  | MessageDownload;

/**
 * Outgoing messages
 */

export interface WorkerDeadMessage {
  type: 'dead';
}

export interface WorkerDownloadMessage {
  type: 'download';
  name: string;
  error?: string;
}

export interface WorkerLogMessage {
  type: 'log';
  message: string;
}

export interface WorkerQueryPanelMessage {
  type: 'query_panel';
  panelId: string;
  message: QueryPanelMessage;
}

export interface WorkerStartMessage {
  type: 'start';
}

export interface WorkerReadBinaryMessage {
  type: 'read_binary';
  id: string;
  uri: string;
}

export interface WorkerReadCellDataMessage {
  type: 'read_cell_data';
  id: string;
  uri: string;
}

export interface WorkerReadMessage {
  type: 'read';
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
  | WorkerStartMessage;

export interface BaseWorker {
  send(message: Message): void;
  off(name: string, callback: (...args: unknown[]) => void): void;
  on(name: string, callback: (...args: unknown[]) => void): void;
}

export interface MessageHandler {
  send(message: WorkerMessage): void;
}

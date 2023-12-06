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

import {NamedQuery, ResultJSON, SerializedExplore} from '@malloydata/malloy';
import {DataStyles} from '@malloydata/render';
import {
  ConnectionBackend,
  ConnectionConfig,
  ExternalConnectionConfig,
} from './connection_manager_types';
import {ProgressType} from 'vscode-jsonrpc';

/*
 * These messages are used to pass status back from the worker to
 * the query result web view
 */

export enum QueryRunStatus {
  Compiling = 'compiling',
  Compiled = 'compiled',
  EstimatedCost = 'estimatedCost',
  Running = 'running',
  Error = 'error',
  Done = 'done',
  StartDownload = 'start-download',
  RunCommand = 'run-command',
  Schema = 'schema',
}

export enum QueryMessageType {
  AppReady = 'app-ready',
}

export interface QueryMessageStartDownload {
  status: QueryRunStatus.StartDownload;
  downloadOptions: QueryDownloadOptions;
}

export interface QueryMessageRunCommand {
  status: QueryRunStatus.RunCommand;
  command: string;
  args: string[];
}

interface QueryMessageStatusCompiling {
  status: QueryRunStatus.Compiling;
}

interface QueryMessageStatusCompiled {
  status: QueryRunStatus.Compiled;
  sql: string;
  dialect: string;
  showSQLOnly: boolean;
}

interface QueryMessageStatusEstimatedCost {
  status: QueryRunStatus.EstimatedCost;
  queryCostBytes: number | undefined;
  schema: SerializedExplore[];
}

interface QueryMessageStatusRunning {
  status: QueryRunStatus.Running;
  sql: string;
  dialect: string;
}

interface QueryMessageStatusError {
  status: QueryRunStatus.Error;
  error: string;
}

interface QueryMessageStatusSchema {
  status: QueryRunStatus.Schema;
  schema: SerializedExplore[];
}

interface QueryMessageStatusDone {
  status: QueryRunStatus.Done;
  resultJson: ResultJSON;
  dataStyles: DataStyles;
  canDownloadStream: boolean;
  defaultTab?: string;
  stats: QueryRunStats;
  profilingUrl?: string;
}

export interface QueryRunStats {
  compileTime: number;
  runTime: number;
  totalTime: number;
}

export type QueryMessageStatus =
  | QueryMessageRunCommand
  | QueryMessageStartDownload
  | QueryMessageStatusCompiling
  | QueryMessageStatusCompiled
  | QueryMessageStatusEstimatedCost
  | QueryMessageStatusError
  | QueryMessageStatusRunning
  | QueryMessageStatusDone
  | QueryMessageStatusSchema;

interface QueryMessageAppReady {
  type: QueryMessageType.AppReady;
}

export interface QueryDownloadOptions {
  format: 'json' | 'csv';
  amount: 'current' | 'all' | number;
}

export type QueryPanelMessage =
  | QueryMessageStatus
  | QueryMessageAppReady
  | QueryMessageStartDownload;

export enum QueryDownloadStatus {
  Compiling = 'compiling',
  Running = 'running',
}

interface QueryDownloadStatusCompiling {
  status: QueryDownloadStatus.Compiling;
}

interface QueryDownloadStatusRunning {
  status: QueryDownloadStatus.Running;
}

export type QueryDownloadMessage =
  | QueryDownloadStatusCompiling
  | QueryDownloadStatusRunning;

export enum ConnectionMessageType {
  EditConnection = 'edit-connection',
  SetConnections = 'set-connections',
  AppReady = 'app-ready',
  TestConnection = 'test-connection',
  RequestBigQueryServiceAccountKeyFile = 'request-bigquery-service-account-key-file',
  InstallExternalConnection = 'install-external-connection',
}

interface ConnectionMessageEditConnection {
  type: ConnectionMessageType.EditConnection;
  id: string | null;
}

interface ConnectionMessageSetConnections {
  type: ConnectionMessageType.SetConnections;
  connections: ConnectionConfig[];
  availableBackends: ConnectionBackend[];
}

interface ConnectionMessageAppReady {
  type: ConnectionMessageType.AppReady;
}

export enum ConnectionTestStatus {
  Waiting = 'waiting',
  Success = 'success',
  Error = 'error',
}

interface ConnectionMessageTestConnectionWaiting {
  type: ConnectionMessageType.TestConnection;
  status: ConnectionTestStatus.Waiting;
  connection: ConnectionConfig;
}

interface ConnectionMessageTestConnectionSuccess {
  type: ConnectionMessageType.TestConnection;
  status: ConnectionTestStatus.Success;
  connection: ConnectionConfig;
}

interface ConnectionMessageTestConnectionError {
  type: ConnectionMessageType.TestConnection;
  status: ConnectionTestStatus.Error;
  error: string;
  connection: ConnectionConfig;
}

export type ConnectionMessageTest =
  | ConnectionMessageTestConnectionWaiting
  | ConnectionMessageTestConnectionSuccess
  | ConnectionMessageTestConnectionError;

export enum ConnectionServiceAccountKeyRequestStatus {
  Waiting = 'waiting',
  Success = 'success',
}

interface ConnectionMessageServiceAccountKeyRequestWaiting {
  type: ConnectionMessageType.RequestBigQueryServiceAccountKeyFile;
  status: ConnectionServiceAccountKeyRequestStatus.Waiting;
  connectionId: string;
}

interface ConnectionMessageServiceAccountKeyRequestSuccess {
  type: ConnectionMessageType.RequestBigQueryServiceAccountKeyFile;
  status: ConnectionServiceAccountKeyRequestStatus.Success;
  connectionId: string;
  serviceAccountKeyPath: string;
}

export type ConnectionMessageServiceAccountKeyRequest =
  | ConnectionMessageServiceAccountKeyRequestWaiting
  | ConnectionMessageServiceAccountKeyRequestSuccess;

export enum InstallExternalConnectionStatus {
  Waiting = 'waiting',
  Success = 'success',
  Error = 'error',
}

interface ConnectionMessageInstallExternalConnectionWaiting {
  type: ConnectionMessageType.InstallExternalConnection;
  status: InstallExternalConnectionStatus.Waiting;
  connection: ExternalConnectionConfig;
}

interface ConnectionMessageInstallExternalConnectionSuccess {
  type: ConnectionMessageType.InstallExternalConnection;
  status: InstallExternalConnectionStatus.Success;
  connection: ExternalConnectionConfig;
}

interface ConnectionMessageInstallExternalConnectionError {
  type: ConnectionMessageType.InstallExternalConnection;
  status: InstallExternalConnectionStatus.Error;
  error: string;
  connection: ExternalConnectionConfig;
}

export type ConnectionMessageInstallExternalConnection =
  | ConnectionMessageInstallExternalConnectionWaiting
  | ConnectionMessageInstallExternalConnectionSuccess
  | ConnectionMessageInstallExternalConnectionError;

export type ConnectionPanelMessage =
  | ConnectionMessageAppReady
  | ConnectionMessageEditConnection
  | ConnectionMessageSetConnections
  | ConnectionMessageTest
  | ConnectionMessageServiceAccountKeyRequest
  | ConnectionMessageInstallExternalConnection;

export enum HelpMessageType {
  AppReady = 'app-ready',
  EditConnections = 'edit-connections',
}

interface HelpMessageAppReady {
  type: HelpMessageType.AppReady;
}

interface HelpMessageEditConnections {
  type: HelpMessageType.EditConnections;
}

export type HelpPanelMessage = HelpMessageAppReady | HelpMessageEditConnections;

export const queryPanelProgress = new ProgressType<QueryMessageStatus>();

export const downloadProgress = new ProgressType<QueryDownloadMessage>();

export interface FetchModelMessage {
  explores: SerializedExplore[];
  queries: NamedQuery[];
}

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
  MalloyError,
  MalloyQueryData,
  NamedQuery,
  ResultJSON,
  SerializedExplore,
} from '@malloydata/malloy';
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
}

export enum MSQLQueryRunStatus {
  Compiling = 'compiling',
  Compiled = 'compiled',
  Running = 'running',
  Error = 'error',
  Done = 'done',
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

interface QueryMessageStatusDone {
  status: QueryRunStatus.Done;
  resultJson: ResultJSON;
  dataStyles: DataStyles;
  canDownloadStream: boolean;
  stats: QueryRunStats;
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
  | QueryMessageStatusDone;

interface QueryMessageAppReady {
  type: QueryMessageType.AppReady;
}

export interface QueryDownloadOptions {
  format: 'json' | 'csv';
  amount: 'current' | 'all' | number;
}

export enum MSQLMessageType {
  AppReady = 'app-ready',
}

interface MSQLMessageAppReady {
  type: QueryMessageType.AppReady;
}

export enum EvaluatedMSQLStatementType {
  CompileError = 'compile-error',
  ExecutionError = 'execution-error',
  Executed = 'executed',
  Compiled = 'compiled',
}

export interface MSQLStatementCompileError {
  type: EvaluatedMSQLStatementType.CompileError;
  errors: MalloyError[];
  statementIndex: number;
}

export interface MSQLStatmentWasCompiled {
  compiledStatement: string;
  statementIndex: number;
}

export interface MSQLStatementExecutionError extends MSQLStatmentWasCompiled {
  type: EvaluatedMSQLStatementType.ExecutionError;
  error: string;
  statementFirstLine: number;
  prettyError?: string;
}

export enum ExecutedMSQLStatementResultType {
  WithStructdef = 'with-structdef',
  WithoutStructdef = 'without-structdef',
}

export interface ExecutedMSQLStatementWithStructdef
  extends MSQLStatmentWasCompiled {
  type: EvaluatedMSQLStatementType.Executed;
  resultType: ExecutedMSQLStatementResultType.WithStructdef;
  results: ResultJSON;
  renderedHTML?: HTMLElement;
}

export interface ExecutedMSQLStatementWithoutStructdef
  extends MSQLStatmentWasCompiled {
  type: EvaluatedMSQLStatementType.Executed;
  resultType: ExecutedMSQLStatementResultType.WithoutStructdef;
  results: MalloyQueryData;
  renderedHTML?: HTMLElement;
}

export interface CompiledMSQLStatement extends MSQLStatmentWasCompiled {
  renderedHTML?: HTMLSpanElement;
  type: EvaluatedMSQLStatementType.Compiled;
}

export type ExecutedMSQLStatement =
  | ExecutedMSQLStatementWithStructdef
  | ExecutedMSQLStatementWithoutStructdef;

export type EvaluatedMSQLStatement =
  | ExecutedMSQLStatement
  | MSQLStatementCompileError
  | MSQLStatementExecutionError
  | CompiledMSQLStatement;

interface MSQLMessageStatusDone {
  status: MSQLQueryRunStatus.Done;
  results: EvaluatedMSQLStatement[];
  showSQLOnly?: boolean;
}

interface MSQLMessageStatusCompiling {
  status: MSQLQueryRunStatus.Compiling;
  totalStatements: number;
  statementIndex: number;
}

interface MSQLMessageStatusRunning {
  status: MSQLQueryRunStatus.Running;
  totalStatements: number;
  statementIndex: number;
}

interface MSQLMessageStatusError {
  status: MSQLQueryRunStatus.Error;
  error: string;
  sql?: string;
}

export type MSQLMessageStatus =
  | MSQLMessageStatusError
  | MSQLMessageStatusCompiling
  | MSQLMessageStatusRunning
  | MSQLMessageStatusDone;

export type MSQLQueryPanelMessage = MSQLMessageStatus | MSQLMessageAppReady;

export type QueryPanelMessage =
  | QueryMessageStatus
  | QueryMessageAppReady
  | QueryMessageStartDownload;

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

export const msqlPanelProgress = new ProgressType<MSQLMessageStatus>();

export interface FetchModelMessage {
  explores: SerializedExplore[];
  queries: NamedQuery[];
}

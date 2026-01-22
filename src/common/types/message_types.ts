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
  ModelDef,
  NamedQuery,
  ResultJSON,
  SerializedExplore,
} from '@malloydata/malloy';
import * as Malloy from '@malloydata/malloy-interfaces';
import {ConnectionBackend, ConnectionConfig} from './connection_manager_types';
import {ProgressType} from 'vscode-jsonrpc';
import {DocumentMetadata} from './query_spec';

export interface RunMalloyQueryResult {
  profilingUrl: string | undefined;
  resultJson: ResultJSON;
  stats: QueryRunStats;
}

export interface RunMalloyQueryStableResult {
  profilingUrl: string | undefined;
  result: Malloy.Result;
  stats: QueryRunStats;
}

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
  StableDone = 'stable-done',
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
  name: string;
  resultJson: ResultJSON;
  canDownloadStream: boolean;
  defaultTab?: string;
  stats: QueryRunStats;
  profilingUrl?: string;
}

interface QueryMessageStatusStableDone {
  status: QueryRunStatus.StableDone;
  name: string;
  result: Malloy.Result;
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
  | QueryMessageStatusStableDone
  | QueryMessageStatusSchema;

interface QueryMessageAppReady {
  type: QueryMessageType.AppReady;
}

export interface QueryDownloadOptions {
  format: 'json' | 'csv';
  amount: 'current' | 'all' | number;
}

export interface QueryDownloadCopyData {
  type: string;
  download: string;
  data: string;
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

/**
 * Edit Connections webview messages
 */

export enum ConnectionMessageType {
  EditConnection = 'edit-connection',
  SetConnections = 'set-connections',
  AppReady = 'app-ready',
  TestConnection = 'test-connection',
  RequestFile = 'request-file',
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

export enum ConnectionServiceFileRequestStatus {
  Waiting = 'waiting',
  Success = 'success',
}

interface ConnectionMessageServiceFileRequestWaiting {
  type: ConnectionMessageType.RequestFile;
  status: ConnectionServiceFileRequestStatus.Waiting;
  connectionId: string;
  configKey: string;
  filters: {
    [name: string]: string[];
  };
}

interface ConnectionMessageServiceFileRequestSuccess {
  type: ConnectionMessageType.RequestFile;
  status: ConnectionServiceFileRequestStatus.Success;
  connectionId: string;
  configKey: string;
  fsPath: string;
}

export type ConnectionMessageServiceAccountKeyRequest =
  | ConnectionMessageServiceFileRequestWaiting
  | ConnectionMessageServiceFileRequestSuccess;

export type ConnectionPanelMessage =
  | ConnectionMessageAppReady
  | ConnectionMessageEditConnection
  | ConnectionMessageSetConnections
  | ConnectionMessageTest
  | ConnectionMessageServiceAccountKeyRequest;

/**
 * Help panel messages
 */

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

/**
 * Composer messages
 */

export enum ComposerMessageType {
  NewModel = 'new-model',
  NewModelInfo = 'new-model-info',
  ResultSuccess = 'result-success',
  StableResultSuccess = 'stable-result-success',
  ResultError = 'result-error',
  SearchIndex = 'search-index',
}

export interface ComposerMessageNewModel {
  type: ComposerMessageType.NewModel;
  documentMeta: DocumentMetadata;
  modelDef: ModelDef;
  sourceName: string;
  viewName?: string;
}

export interface ComposerMessageNewModelInfo {
  type: ComposerMessageType.NewModelInfo;
  documentMeta: DocumentMetadata;
  model: Malloy.ModelInfo;
  modelDef: ModelDef; // TODO: remove once modelInfo can be used to parse/compile
  sourceName: string;
  viewName?: string;
  initialQuery?: Malloy.Query;
}

export interface ComposerMessageResultSuccess {
  type: ComposerMessageType.ResultSuccess;
  id: string;
  result: RunMalloyQueryResult;
}

export interface ComposerMessageStableResultSuccess {
  type: ComposerMessageType.StableResultSuccess;
  id: string;
  result: RunMalloyQueryStableResult;
}

export interface ComposerMessageResultError {
  type: ComposerMessageType.ResultError;
  id: string;
  error: string;
}

export interface ComposerMessageSearchIndex {
  type: ComposerMessageType.SearchIndex;
  result: RunMalloyQueryResult;
}

export type ComposerMessage =
  | ComposerMessageNewModel
  | ComposerMessageNewModelInfo
  | ComposerMessageResultSuccess
  | ComposerMessageResultError
  | ComposerMessageSearchIndex
  | ComposerMessageStableResultSuccess;

export enum ComposerPageMessageType {
  Ready = 'ready',
  RunQuery = 'run-query',
  RunStableQuery = 'run-stable-query',
  RefreshModel = 'refresh-model',
  RefreshStableModel = 'refresh-stable-model',
  OnDrill = 'on-drill',
  OnDownload = 'on-download',
}

export interface ComposerPageMessageReady {
  type: ComposerPageMessageType.Ready;
}

export interface ComposerPageMessageRunQuery {
  type: ComposerPageMessageType.RunQuery;
  id: string;
  query: string;
  queryName: string;
}

export interface ComposerPageMessageRunStableQuery {
  type: ComposerPageMessageType.RunStableQuery;
  id: string;
  source: Malloy.SourceInfo;
  query: Malloy.Query;
}

export interface ComposerPageMessageRefreshModel {
  type: ComposerPageMessageType.RefreshModel;
  query: string;
}

export interface ComposerPageMessageRefreshStableModel {
  type: ComposerPageMessageType.RefreshStableModel;
  source: Malloy.SourceInfo;
  query: Malloy.Query;
}

export interface ComposerPageMessageOnDrill {
  type: ComposerPageMessageType.OnDrill;
  stableQuery: Malloy.Query | undefined;
  stableDrillClauses: Malloy.DrillOperation[] | undefined;
}

export interface ComposerPageMessageOnDownload {
  type: ComposerPageMessageType.OnDownload;
  source: Malloy.SourceInfo;
  query: Malloy.Query | string;
  result: Malloy.Result | undefined;
  name: string;
  format: 'json' | 'csv';
}

export type ComposerPageMessage =
  | ComposerPageMessageReady
  | ComposerPageMessageRunQuery
  | ComposerPageMessageRunStableQuery
  | ComposerPageMessageRefreshModel
  | ComposerPageMessageRefreshStableModel
  | ComposerPageMessageOnDrill
  | ComposerPageMessageOnDownload;

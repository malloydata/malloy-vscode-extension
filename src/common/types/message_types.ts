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
  NamedQueryDef,
  ResultJSON,
  SerializedExplore,
} from '@malloydata/malloy';
import * as Malloy from '@malloydata/malloy-interfaces';
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
 * Connection editor panel messages
 */

export enum ConnectionTestStatus {
  Waiting = 'waiting',
  Success = 'success',
  Error = 'error',
}

export enum ConnectionServiceFileRequestStatus {
  Waiting = 'waiting',
  Success = 'success',
}

export enum SingleConnectionMessageType {
  AppReady = 'app-ready',
  LoadConnection = 'load-connection',
  SaveConnection = 'save-connection',
  DeleteConnection = 'delete-connection',
  TestConnection = 'test-connection',
  RequestFile = 'request-file',
  CancelConnection = 'cancel-connection',
  DuplicateConnection = 'duplicate-connection',
}

export interface ConnectionPropertyInfo {
  name: string;
  displayName: string;
  type: string;
  optional?: true;
  default?: string;
  description?: string;
  fileFilters?: Record<string, string[]>;
}

export interface SingleConnectionMessageAppReady {
  type: SingleConnectionMessageType.AppReady;
}

export interface SingleConnectionMessageLoadConnection {
  type: SingleConnectionMessageType.LoadConnection;
  name: string;
  uuid: string;
  typeName: string;
  typeDisplayName: string;
  properties: ConnectionPropertyInfo[];
  values: Record<string, string | number | boolean>;
  existingNames: string[];
  registeredTypes: string[];
  isNew: boolean;
  readonly?: boolean;
}

export interface SingleConnectionMessageSaveConnection {
  type: SingleConnectionMessageType.SaveConnection;
  originalName: string;
  name: string;
  values: Record<string, string | number | boolean>;
}

export interface SingleConnectionMessageDeleteConnection {
  type: SingleConnectionMessageType.DeleteConnection;
  name: string;
}

export interface SingleConnectionMessageTestConnectionRequest {
  type: SingleConnectionMessageType.TestConnection;
  status: ConnectionTestStatus.Waiting;
  name: string;
  values: Record<string, string | number | boolean>;
}

export interface SingleConnectionMessageTestConnectionSuccess {
  type: SingleConnectionMessageType.TestConnection;
  status: ConnectionTestStatus.Success;
}

export interface SingleConnectionMessageTestConnectionError {
  type: SingleConnectionMessageType.TestConnection;
  status: ConnectionTestStatus.Error;
  error: string;
}

export type SingleConnectionMessageTestConnection =
  | SingleConnectionMessageTestConnectionRequest
  | SingleConnectionMessageTestConnectionSuccess
  | SingleConnectionMessageTestConnectionError;

export interface SingleConnectionMessageRequestFileWaiting {
  type: SingleConnectionMessageType.RequestFile;
  status: ConnectionServiceFileRequestStatus.Waiting;
  propName: string;
  filters: Record<string, string[]>;
}

export interface SingleConnectionMessageRequestFileSuccess {
  type: SingleConnectionMessageType.RequestFile;
  status: ConnectionServiceFileRequestStatus.Success;
  propName: string;
  fsPath: string;
}

export type SingleConnectionMessageRequestFile =
  | SingleConnectionMessageRequestFileWaiting
  | SingleConnectionMessageRequestFileSuccess;

export interface SingleConnectionMessageCancelConnection {
  type: SingleConnectionMessageType.CancelConnection;
}

export interface SingleConnectionMessageDuplicateConnection {
  type: SingleConnectionMessageType.DuplicateConnection;
  name: string;
  values: Record<string, string | number | boolean>;
}

export type SingleConnectionMessage =
  | SingleConnectionMessageAppReady
  | SingleConnectionMessageLoadConnection
  | SingleConnectionMessageSaveConnection
  | SingleConnectionMessageDeleteConnection
  | SingleConnectionMessageTestConnection
  | SingleConnectionMessageRequestFile
  | SingleConnectionMessageCancelConnection
  | SingleConnectionMessageDuplicateConnection;

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
  queries: NamedQueryDef[];
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

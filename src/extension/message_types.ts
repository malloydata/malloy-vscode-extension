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

import { ResultJSON } from "@malloydata/malloy";
import { DataStyles } from "@malloydata/render";
import { ConnectionConfig } from "../common";

export enum QueryRunStatus {
  Compiling = "compiling",
  Running = "running",
  Error = "error",
  Done = "done",
}

export enum QueryMessageType {
  QueryStatus = "query-status",
  AppReady = "app-ready",
  StartDownload = "start-download",
}

interface QueryMessageStatusCompiling {
  type: QueryMessageType.QueryStatus;
  status: QueryRunStatus.Compiling;
}

interface QueryMessageStatusRunning {
  type: QueryMessageType.QueryStatus;
  status: QueryRunStatus.Running;
  sql: string;
  dialect: string;
}

interface QueryMessageStatusError {
  type: QueryMessageType.QueryStatus;
  status: QueryRunStatus.Error;
  error: string;
}

interface QueryMessageStatusDone {
  type: QueryMessageType.QueryStatus;
  status: QueryRunStatus.Done;
  result: ResultJSON;
  styles: DataStyles;
}

type QueryMessageStatus =
  | QueryMessageStatusCompiling
  | QueryMessageStatusError
  | QueryMessageStatusRunning
  | QueryMessageStatusDone;

interface QueryMessageAppReady {
  type: QueryMessageType.AppReady;
}

export interface QueryDownloadOptions {
  format: "json" | "csv";
  amount: "current" | "all" | number;
}

interface QueryMessageStartDownload {
  type: QueryMessageType.StartDownload;
  downloadOptions: QueryDownloadOptions;
}

export type QueryPanelMessage =
  | QueryMessageStatus
  | QueryMessageAppReady
  | QueryMessageStartDownload;

export enum ConnectionMessageType {
  SetConnections = "set-connections",
  AppReady = "app-ready",
  TestConnection = "test-connection",
  RequestBigQueryServiceAccountKeyFile = "request-bigquery-service-account-key-file",
}

interface ConnectionMessageSetConnections {
  type: ConnectionMessageType.SetConnections;
  connections: ConnectionConfig[];
}

interface ConnectionMessageAppReady {
  type: ConnectionMessageType.AppReady;
}

export enum ConnectionTestStatus {
  Waiting = "waiting",
  Success = "success",
  Error = "error",
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
  Waiting = "waiting",
  Success = "success",
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

export type ConnectionPanelMessage =
  | ConnectionMessageAppReady
  | ConnectionMessageSetConnections
  | ConnectionMessageTest
  | ConnectionMessageServiceAccountKeyRequest;

export enum HelpMessageType {
  AppReady = "app-ready",
  EditConnections = "edit-connections",
}

interface HelpMessageAppReady {
  type: HelpMessageType.AppReady;
}

interface HelpMessageEditConnections {
  type: HelpMessageType.EditConnections;
}

export type HelpPanelMessage = HelpMessageAppReady | HelpMessageEditConnections;

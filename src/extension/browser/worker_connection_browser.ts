/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import {GenericConnection} from '../../common/types/worker_message_types';
import {FileHandler} from '../../common/types/file_handler';
import {WorkerConnection} from '../worker_connection';

export class WorkerConnectionBrowser extends WorkerConnection {
  _connection: GenericConnection;

  constructor(
    context: vscode.ExtensionContext,
    connection: GenericConnection,
    fileHandler: FileHandler
  ) {
    super(context, fileHandler);
    this._connection = connection;
  }

  get connection() {
    return this._connection;
  }

  dispose(): void {}
}

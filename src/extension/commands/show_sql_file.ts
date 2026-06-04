/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import {WorkerConnection} from '../worker_connection';
import {
  getActiveDocumentMetadata,
  runMalloyQueryWithProgress,
} from './utils/run_query_utils';
import {RunMalloyQueryResult} from '../../common/types/message_types';

export async function showSQLFileCommand(
  context: vscode.ExtensionContext,
  worker: WorkerConnection,
  queryIndex = -1
): Promise<RunMalloyQueryResult | undefined> {
  const documentMeta = getActiveDocumentMetadata();
  if (documentMeta) {
    return runMalloyQueryWithProgress(
      context,
      worker,
      {type: 'file', index: queryIndex, documentMeta},
      documentMeta.uri,
      documentMeta.fileName.split('/').pop() || documentMeta.fileName,
      {showSQLOnly: true}
    );
  }
  return undefined;
}

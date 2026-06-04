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

export async function showSQLCommand(
  context: vscode.ExtensionContext,
  worker: WorkerConnection,
  query: string,
  name?: string
): Promise<RunMalloyQueryResult | undefined> {
  const documentMeta = getActiveDocumentMetadata();
  if (documentMeta) {
    return runMalloyQueryWithProgress(
      context,
      worker,
      {type: 'string', text: query, documentMeta},
      `${documentMeta.uri} ${name}`,
      name || documentMeta.uri,
      {showSQLOnly: true}
    );
  }
  return undefined;
}

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

export async function showSQLNamedQueryCommand(
  context: vscode.ExtensionContext,
  worker: WorkerConnection,
  name: string
): Promise<RunMalloyQueryResult | undefined> {
  const documentMeta = getActiveDocumentMetadata();
  if (documentMeta) {
    return runMalloyQueryWithProgress(
      context,
      worker,
      {type: 'named', name, documentMeta},
      `${documentMeta.uri} ${name}`,
      name,
      {showSQLOnly: true}
    );
  }
  return undefined;
}

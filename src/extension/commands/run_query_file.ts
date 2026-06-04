/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';

import {
  runMalloyQueryWithProgress,
  getActiveDocumentMetadata,
} from './utils/run_query_utils';
import {WorkerConnection} from '../worker_connection';
import {RunMalloyQueryResult} from '../../common/types/message_types';

export async function runQueryFileCommand(
  context: vscode.ExtensionContext,
  worker: WorkerConnection,
  queryIndex = -1
): Promise<RunMalloyQueryResult | undefined> {
  const documentMeta = getActiveDocumentMetadata();
  if (documentMeta) {
    return runMalloyQueryWithProgress(
      context,
      worker,
      {
        type: 'file',
        index: queryIndex,
        documentMeta,
      },
      documentMeta.uri,
      documentMeta.fileName.split('/').pop() || documentMeta.fileName
    );
  }
  return undefined;
}

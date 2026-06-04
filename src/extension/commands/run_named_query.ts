/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';

import {RunMalloyQueryResult} from '../../common/types/message_types';
import {WorkerConnection} from '../worker_connection';
import {
  getActiveDocumentMetadata,
  runMalloyQueryWithProgress,
} from './utils/run_query_utils';

export async function runNamedQuery(
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
      name
    );
  }
  return undefined;
}

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';

import {RunMalloyQueryResult} from '../../common/types/message_types';
import {WorkerConnection} from '../worker_connection';
import {
  getActiveDocumentMetadata,
  getDocumentMetadataFromUri,
  runMalloyQueryWithProgress,
} from './utils/run_query_utils';

export async function runQueryCommand(
  context: vscode.ExtensionContext,
  worker: WorkerConnection,
  query: string,
  name?: string,
  defaultTab?: string,
  uri?: string
): Promise<RunMalloyQueryResult | undefined> {
  const documentMeta = uri
    ? getDocumentMetadataFromUri(uri)
    : getActiveDocumentMetadata();
  if (documentMeta) {
    return runMalloyQueryWithProgress(
      context,
      worker,
      {type: 'string', text: query, documentMeta},
      `${documentMeta.uri} ${name}`,
      name || documentMeta.uri,
      {defaultTab}
    );
  }
  return undefined;
}

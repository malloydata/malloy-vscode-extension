/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';

import {WorkerConnection} from '../worker_connection';
import {
  getActiveDocumentMetadata,
  getDocumentMetadataFromUri,
  runMalloyQueryWithProgress,
} from './utils/run_query_utils';
import {RunMalloyQueryResult} from '../../common/types/message_types';

export async function showSchemaFileCommand(
  context: vscode.ExtensionContext,
  worker: WorkerConnection,
  uri?: string
): Promise<RunMalloyQueryResult | undefined> {
  const documentMeta = uri
    ? getDocumentMetadataFromUri(uri)
    : getActiveDocumentMetadata();
  if (documentMeta) {
    return runMalloyQueryWithProgress(
      context,
      worker,
      {type: 'file', index: -1, documentMeta},
      documentMeta.uri,
      documentMeta.fileName.split('/').pop() || documentMeta.fileName,
      {showSchemaOnly: true}
    );
  }
  return undefined;
}

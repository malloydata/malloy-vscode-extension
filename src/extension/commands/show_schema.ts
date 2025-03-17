/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {WorkerConnection} from '../worker_connection';
import {
  getActiveDocumentMetadata,
  runMalloyQueryWithProgress,
} from './utils/run_query_utils';
import {RunMalloyQueryResult} from '../../common/types/message_types';

export async function showSchemaCommand(
  worker: WorkerConnection,
  exploreName: string
): Promise<RunMalloyQueryResult | undefined> {
  const documentMeta = getActiveDocumentMetadata();
  if (documentMeta) {
    return runMalloyQueryWithProgress(
      worker,
      {type: 'file', exploreName, documentMeta},
      `${documentMeta.uri} ${exploreName}`,
      `Schema: ${exploreName}`,
      {showSchemaOnly: true}
    );
  }
  return undefined;
}

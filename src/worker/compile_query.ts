/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {ConnectionManager} from '../common/connection_manager';
import {CellData, FileHandler} from '../common/types/file_handler';
import {createModelMaterializer} from './create_runnable';
import {DocumentMetadata} from '../common/types/query_spec';
import {ModelDef, Runtime} from '@malloydata/malloy';

export const compileQuery = async (
  fileHandler: FileHandler,
  connectionManager: ConnectionManager,
  documentMeta: DocumentMetadata,
  query?: string
): Promise<ModelDef | undefined> => {
  const {uri} = documentMeta;
  const url = new URL(uri);
  const connectionLookup = connectionManager.getConnectionLookup(url);
  const runtime = new Runtime({
    urlReader: fileHandler,
    connections: connectionLookup,
  });

  let workspaceFolders: string[] = [];
  if (url.protocol === 'untitled:') {
    workspaceFolders = await fileHandler.fetchWorkspaceFolders(uri);
  }

  let cellData: CellData | null = null;

  if (url.protocol === 'vscode-notebook-cell:') {
    cellData = await fileHandler.fetchCellData(uri);
  }

  const modelMaterializer = await createModelMaterializer(
    uri,
    runtime,
    cellData,
    workspaceFolders
  );

  if (query && modelMaterializer) {
    await modelMaterializer.loadQuery(query).getPreparedQuery();
  }

  const model = await modelMaterializer?.getModel();
  return model?._modelDef;
};

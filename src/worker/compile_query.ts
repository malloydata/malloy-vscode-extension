/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {ConnectionManager} from '../common/types/connection_manager_types';
import {CellData, FileHandler} from '../common/types/file_handler';
import {createModelMaterializer} from './create_runnable';
import {DocumentMetadata} from '../common/types/query_spec';
import {ModelDef, Runtime} from '@malloydata/malloy';
import {idleRuntime} from '../util/idle_runtime';

export const compileQuery = async (
  fileHandler: FileHandler,
  connectionManager: ConnectionManager,
  documentMeta: DocumentMetadata,
  query?: string
): Promise<ModelDef | undefined> => {
  const {uri} = documentMeta;
  const url = new URL(uri);
  const config = await connectionManager.getConfigForFile(url);
  const runtime = new Runtime({
    urlReader: fileHandler,
    config,
  });
  try {
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
  } finally {
    await idleRuntime(runtime);
  }
};

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  ModelMaterializer,
  QueryMaterializer,
  Runtime,
} from '@malloydata/malloy';
import {CellData} from '../common/types/file_handler';
import {QuerySpec} from '../common/types/query_spec';

export const createModelMaterializer = async (
  uri: string,
  runtime: Runtime,
  cellData: CellData | null,
  workspaceFolders: string[],
  refreshSchemaCache?: boolean | number
): Promise<ModelMaterializer | null> => {
  console.debug('createModelMaterializer', uri, 'begin');

  let mm: ModelMaterializer | null = null;
  const queryFileURL = new URL(uri);
  if (cellData) {
    if (refreshSchemaCache && typeof refreshSchemaCache !== 'number') {
      refreshSchemaCache = Date.now();
    }
    const importBaseURL = new URL(cellData.baseUri);
    for (const cell of cellData.cells) {
      if (cell.languageId === 'malloy') {
        const url = new URL(cell.uri);
        if (mm) {
          mm = mm.extendModel(url, {importBaseURL, refreshSchemaCache});
        } else {
          mm = runtime.loadModel(url, {importBaseURL, refreshSchemaCache});
        }
      }
    }
  } else {
    let importBaseURL: URL | undefined;
    if (queryFileURL.protocol === 'untitled:') {
      if (workspaceFolders[0]) {
        importBaseURL = new URL(workspaceFolders[0] + '/');
      }
    }
    mm = runtime.loadModel(queryFileURL, {importBaseURL, refreshSchemaCache});
  }
  console.debug('createModelMaterializer', uri, 'end');
  return mm;
};

export const createRunnable = async (
  query: QuerySpec,
  runtime: Runtime,
  cellData: CellData | null,
  workspaceFolders: string[]
): Promise<QueryMaterializer> => {
  const {
    documentMeta: {uri},
  } = query;
  console.debug('createRunnable', uri, 'begin');
  let runnable: QueryMaterializer;
  const mm = await createModelMaterializer(
    uri,
    runtime,
    cellData,
    workspaceFolders
  );
  if (!mm) {
    throw new Error('Missing model definition');
  }
  switch (query.type) {
    case 'string':
      runnable = mm.loadQuery(query.text);
      break;
    case 'named':
      runnable = mm.loadQueryByName(query.name);
      break;
    case 'file': {
      if (query.index === undefined || query.index === -1) {
        runnable = mm.loadFinalQuery();
      } else {
        runnable = mm.loadQueryByIndex(query.index);
      }
      break;
    }
    default:
      throw new Error('Internal Error: Unexpected query type');
  }
  console.debug('createRunnable', uri, 'end');
  return runnable;
};

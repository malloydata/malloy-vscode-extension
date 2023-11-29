/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {
  ModelMaterializer,
  QueryMaterializer,
  Runtime,
  SQLBlockMaterializer,
} from '@malloydata/malloy';
import {CellData} from '../common/types';
import {QuerySpec} from '../common/query_spec';

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
): Promise<SQLBlockMaterializer | QueryMaterializer> => {
  const {
    documentMeta: {uri},
  } = query;
  console.debug('createRunnable', uri, 'begin');
  let runnable: QueryMaterializer | SQLBlockMaterializer;
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
    case 'file':
      if (query.index === -1) {
        runnable = mm.loadFinalQuery();
      } else {
        runnable = mm.loadQueryByIndex(query.index);
      }
      break;
    case 'named_sql':
      runnable = mm.loadSQLBlockByName(query.name);
      break;
    case 'unnamed_sql':
      runnable = mm.loadSQLBlockByIndex(query.index);
      break;
    default:
      throw new Error('Internal Error: Unexpected query type');
  }
  console.debug('createRunnable', uri, 'end');
  return runnable;
};

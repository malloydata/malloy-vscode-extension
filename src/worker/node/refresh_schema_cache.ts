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

import {Runtime} from '@malloydata/malloy';
import {MessageRefreshSchemaCache} from '../../common/types/worker_message_types';
import {CellData, FileHandler} from '../../common/types/file_handler';
import {ConnectionManager} from '../../common/connection_manager';
import {createModelMaterializer} from '../create_runnable';

export const refreshSchemaCache = async (
  connectionManager: ConnectionManager,
  fileHandler: FileHandler,
  {uri}: MessageRefreshSchemaCache
): Promise<void> => {
  const url = new URL(uri);
  const connectionLookup = connectionManager.getConnectionLookup(url);
  const runtime = new Runtime(fileHandler, connectionLookup);

  let cellData: CellData | null = null;
  if (url.protocol === 'vscode-notebook-cell:') {
    cellData = await fileHandler.fetchCellData(uri);
  }
  let workspaceFolders: string[] = [];
  if (url.protocol === 'untitled:') {
    workspaceFolders = await fileHandler.fetchWorkspaceFolders(uri);
  }

  const mm = await createModelMaterializer(
    uri,
    runtime,
    cellData,
    workspaceFolders,
    true
  );
  await mm?.getModel();
};

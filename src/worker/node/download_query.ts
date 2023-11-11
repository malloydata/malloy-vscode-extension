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

import * as fs from 'fs';
import {fileURLToPath} from 'url';
import {CSVWriter, JSONWriter, Runtime} from '@malloydata/malloy';
import {
  MessageDownload,
  WorkerMessageHandler,
  WorkerDownloadMessage,
} from '../../common/worker_message_types';
import {createRunnable} from '../create_runnable';
import {CellData, FileHandler} from '../../common/types';
import {ConnectionManager} from '../../common/connection_manager';
import {errorMessage} from '../../common/errors';

const sendMessage = (
  messageHandler: WorkerMessageHandler,
  name: string,
  error?: string
) => {
  const msg: WorkerDownloadMessage = {
    name,
    error,
  };
  messageHandler.sendRequest('malloy/download', msg);
};

export async function downloadQuery(
  messageHandler: WorkerMessageHandler,
  connectionManager: ConnectionManager,
  {query, panelId, downloadOptions, name, uri}: MessageDownload,
  fileHandler: FileHandler
): Promise<void> {
  const url = new URL(panelId);

  try {
    const runtime = new Runtime(
      fileHandler,
      connectionManager.getConnectionLookup(url, false)
    );

    let cellData: CellData | null = null;
    if (query.uri.startsWith('vscode-notebook-cell:')) {
      cellData = await fileHandler.fetchCellData(query.uri);
    }
    let workspaceFolders: string[] = [];
    if (query.uri.startsWith('untitled:')) {
      workspaceFolders = await fileHandler.fetchWorkspaceFolders(query.uri);
    }
    const runnable = await createRunnable(
      query,
      runtime,
      cellData,
      workspaceFolders
    );

    const writeStream = fs.createWriteStream(fileURLToPath(uri));
    const writer =
      downloadOptions.format === 'json'
        ? new JSONWriter(writeStream)
        : new CSVWriter(writeStream);
    const rowLimit =
      typeof downloadOptions.amount === 'number'
        ? downloadOptions.amount
        : undefined;
    const rowStream = runnable.runStream({
      rowLimit,
    });
    await writer.process(rowStream);
    sendMessage(messageHandler, name);
  } catch (error) {
    sendMessage(messageHandler, errorMessage(error));
  }
}

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
} from '../../common/types/worker_message_types';
import {createRunnable} from '../create_runnable';
import {CellData, FileHandler} from '../../common/types/file_handler';
import {ConnectionManager} from '../../common/types/connection_manager_types';
import {CancellationToken, ProgressType} from 'vscode-jsonrpc';
import {
  QueryDownloadMessage,
  QueryDownloadStatus,
} from '../../common/types/message_types';
import {noAwait} from '../../util/no_await';

export async function downloadQuery(
  messageHandler: WorkerMessageHandler,
  connectionManager: ConnectionManager,
  {query, downloadOptions, panelId, downloadUri}: MessageDownload,
  fileHandler: FileHandler,
  cancellationToken: CancellationToken
): Promise<void> {
  const {
    documentMeta: {uri},
  } = query;

  const sendMessage = (message: QueryDownloadMessage) => {
    console.debug('sendMessage', panelId, message.status);
    const progress = new ProgressType<QueryDownloadMessage>();
    noAwait(messageHandler.sendProgress(progress, panelId, message));
  };

  const url = new URL(uri);
  const abortController = new AbortController();
  cancellationToken.onCancellationRequested(() => {
    abortController.abort();
  });

  const runtime = new Runtime({
    urlReader: fileHandler,
    connections: connectionManager.getConnectionLookup(url),
  });

  sendMessage({
    status: QueryDownloadStatus.Compiling,
  });

  let cellData: CellData | null = null;
  if (uri.startsWith('vscode-notebook-cell:')) {
    cellData = await fileHandler.fetchCellData(uri);
  }
  let workspaceFolders: string[] = [];
  if (uri.startsWith('untitled:')) {
    workspaceFolders = await fileHandler.fetchWorkspaceFolders(uri);
  }
  const runnable = await createRunnable(
    query,
    runtime,
    cellData,
    workspaceFolders
  );

  sendMessage({
    status: QueryDownloadStatus.Running,
  });

  console.info(`Downloading ${uri} to ${downloadUri} `);
  const writeStream = fs.createWriteStream(fileURLToPath(downloadUri));
  try {
    const writer =
      downloadOptions.format === 'json'
        ? new JSONWriter(writeStream)
        : new CSVWriter(writeStream);
    const rowLimit =
      typeof downloadOptions.amount === 'number'
        ? downloadOptions.amount
        : undefined;
    console.info(
      `Downloading ${
        typeof rowLimit === 'undefined' ? 'unlimited' : rowLimit
      } rows`
    );
    const rowStream = runnable.runStream({
      rowLimit,
      abortSignal: abortController.signal,
    });
    await writer.process(rowStream);
  } finally {
    writeStream.close();
  }
  console.info(`Finished downloading ${uri} to ${downloadUri} `);
}

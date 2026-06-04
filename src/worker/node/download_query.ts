/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
import {idleRuntime} from '../../util/idle_runtime';
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
  const config = await connectionManager.getConfigForFile(url);
  const runtime = new Runtime({
    urlReader: fileHandler,
    config,
  });
  try {
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
  } finally {
    await idleRuntime(runtime);
  }
}

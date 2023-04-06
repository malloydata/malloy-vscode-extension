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
/* eslint-disable no-console */

import {CSVWriter, JSONWriter, Result, WriteStream} from '@malloydata/malloy';
import {QueryDownloadOptions} from '../../common/message_types';

import * as vscode from 'vscode';
import {Utils} from 'vscode-uri';
import {QuerySpec} from './query_spec';
import {
  BaseWorker,
  MessageDownload,
  WorkerMessage,
  WorkerQuerySpec,
} from '../../common/worker_message_types';
import {MALLOY_EXTENSION_STATE} from '../state';
import {Disposable} from 'vscode-jsonrpc';

/**
 * VSCode doesn't support streaming writes, so fake it.
 */

class VSCodeWriteStream implements WriteStream {
  contents = '';

  constructor(private uri: vscode.Uri) {}

  async close() {
    vscode.workspace.fs.writeFile(
      this.uri,
      new TextEncoder().encode(this.contents)
    );
  }

  async write(chunk?: string) {
    this.contents = this.contents += chunk;
    return Promise.resolve(undefined);
  }
}

const sendDownloadMessage = (
  worker: BaseWorker,
  query: WorkerQuerySpec,
  panelId: string,
  name: string,
  uri: string,
  downloadOptions: QueryDownloadOptions
) => {
  const message: MessageDownload = {
    type: 'download',
    query,
    panelId,
    name,
    uri,
    downloadOptions,
  };
  worker.send?.(message);
};

export async function queryDownload(
  worker: BaseWorker,
  query: QuerySpec,
  downloadOptions: QueryDownloadOptions,
  currentResults: Result,
  panelId: string,
  name: string
): Promise<void> {
  const configDownloadPath = vscode.workspace
    .getConfiguration('malloy')
    .get('downloadsPath');
  let downloadPath =
    configDownloadPath && typeof configDownloadPath === 'string'
      ? configDownloadPath
      : '~/Downloads';

  const homeUri = MALLOY_EXTENSION_STATE.getHomeUri();
  if (homeUri) {
    downloadPath = downloadPath.replace(/^~/, homeUri.fsPath);
  }
  const downloadPathUri = vscode.Uri.file(downloadPath);
  try {
    const stat = await vscode.workspace.fs.stat(downloadPathUri);
    if (!(stat.type & vscode.FileType.Directory)) {
      vscode.window.showErrorMessage(
        `Download path ${downloadPath} is not a directory.`
      );
      return;
    }
  } catch (error) {
    console.error(error);
    vscode.window.showErrorMessage(
      `Download path ${downloadPath} is not accessible.`
    );
    return;
  }

  const fileExtension = downloadOptions.format === 'json' ? 'json' : 'csv';
  const fileUri = await dedupeFileName(downloadPathUri, name, fileExtension);
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Malloy Download (${name})`,
      cancellable: false,
    },
    async () => {
      try {
        let off: Disposable;
        if (downloadOptions.amount === 'current') {
          const writeStream = new VSCodeWriteStream(fileUri);
          const writer =
            downloadOptions.format === 'json'
              ? new JSONWriter(writeStream)
              : new CSVWriter(writeStream);
          const rowStream = currentResults.data.inMemoryStream();
          await writer.process(rowStream);
          vscode.window.showInformationMessage(
            `Malloy Download (${name}): Complete`
          );
        } else {
          const {file, ...params} = query;
          sendDownloadMessage(
            worker,
            {
              uri: file.uri.toString(),
              ...params,
            },
            panelId,
            name,
            fileUri.toString(),
            downloadOptions
          );
          const listener = (msg: WorkerMessage) => {
            if (msg.type === 'malloy/dead') {
              vscode.window.showErrorMessage(
                `Malloy Download (${name}): Error
The worker process has died, and has been restarted.
This is possibly the result of a database bug. \
Please consider filing an issue with as much detail as possible at \
https://github.com/malloydata/malloy/issues.`
              );

              off?.dispose();
              return;
            } else if (msg.type !== 'malloy/download') {
              return;
            }
            const {name: msgName, error} = msg;
            if (msgName !== name) {
              return;
            }
            if (error) {
              vscode.window.showErrorMessage(
                `Malloy Download (${name}): Error\n${error}`
              );
            } else {
              vscode.window.showInformationMessage(
                `Malloy Download (${name}): Complete`
              );
            }
            off?.dispose();
          };

          off = worker.on('malloy/download', listener);
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Malloy Download (${name}): Error\n${error.message}`
        );
      }
    }
  );
}

async function dedupeFileName(uri: vscode.Uri, name: string, ext: string) {
  let index = 0;
  let attempt = Utils.joinPath(uri, `${name}.${ext}`);
  try {
    let stat = await vscode.workspace.fs.stat(attempt);
    while (stat) {
      attempt = Utils.joinPath(uri, `${name} ${++index}.${ext}`);
      try {
        stat = await vscode.workspace.fs.stat(attempt);
      } catch {
        stat = null;
      }
    }
  } catch {
    // Hopefully nothing bad...
  }
  return attempt;
}

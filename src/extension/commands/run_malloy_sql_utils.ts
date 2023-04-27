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

import * as vscode from 'vscode';

import {BaseWorker, WorkerMessage} from '../../common/worker_message_types';
import {malloyLog} from '../logger';

export function runMalloySQLQuery(
  worker: BaseWorker,
  connectionName: string,
  query: string,
  panelId: string,
  name: string
): void {
  worker.send({
    type: 'malloy-sql/run',
    query,
    connectionName,
    panelId,
  });

  // const current: RunState = createOrReuseWebviewPanel(
  //   'malloyQuery',
  //   name,
  //   panelId,
  //   cancel,
  //   query.file
  // );
  // const queryPageOnDiskPath = Utils.joinPath(
  //   MALLOY_EXTENSION_STATE.getExtensionUri(),
  //   'dist',
  //   'query_page.js'
  // );
  // loadWebview(current, queryPageOnDiskPath);
  // const uri = file.uri.toString();
  // worker.send({
  //   type: 'malloy-query/run',
  //   query: {
  //     uri,
  //     ...params,
  //   },
  //   panelId,
  //   name,
  // });
  // const allBegin = Date.now();
  // const compileBegin = allBegin;
  // let runBegin: number;
}

function logTime(name: string, start: number, end: number) {
  malloyLog.appendLine(
    `${name} time: ${((end - start) / 1000).toLocaleString()}s`
  );
}

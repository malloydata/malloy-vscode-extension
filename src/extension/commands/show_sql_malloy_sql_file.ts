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
import {BaseWorker} from '../../common/worker_message_types';
import {runMalloySQLQuery} from './run_malloy_sql_utils';

export function showSQLMalloySQLFile(worker: BaseWorker): void {
  const document = vscode.window.activeTextEditor?.document;

  if (document) {
    const lineComments = document.getText().match(/--.*?(\n|$)/g) || [];
    const connectionName =
      lineComments && lineComments.length > 0
        ? lineComments[0]?.split('connection:')[1]?.trim()
        : '';

    const source =
      lineComments && lineComments.length > 1
        ? lineComments[1]?.split('source:')[1]?.trim()
        : '';

    runMalloySQLQuery(
      worker,
      document.uri.toString(),
      document.fileName.split('/').pop() || document.fileName,
      document.getText(),
      connectionName,
      source,
      true
    );
  }
}

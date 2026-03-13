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

import * as assert from 'assert';

import * as vscode from 'vscode';
import * as path from 'path';

import {ResultJSON} from '@malloydata/malloy';

interface RunMalloyQueryResult {
  resultJson: ResultJSON;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Smoke tests', function () {
  this.timeout(30000);

  it('Activate and run a query', async () => {
    const filePath = path.resolve(__dirname, '../../tests/data/test.malloy');
    const document = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(document);

    // Retry to handle race where the editor/extension isn't fully ready
    let result: RunMalloyQueryResult | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      result = await vscode.commands.executeCommand<
        RunMalloyQueryResult | undefined
      >('malloy.runQueryFile');
      if (result !== undefined) break;
      await sleep(1000);
    }

    assert.deepStrictEqual(result?.resultJson.queryResult.result, [{one: 1}]);
  });
});

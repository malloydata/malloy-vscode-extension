/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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

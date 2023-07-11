import * as assert from 'assert';

import * as vscode from 'vscode';
import * as path from 'path';

import {ResultJSON} from '@malloydata/malloy';

suite('Smoke tests', function () {
  this.timeout(20000);

  test('Activate and run a query', async () => {
    const filePath = path.resolve(__dirname, '../../suite/data/test.malloy');
    const document = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(document);
    const resultJson = await vscode.commands.executeCommand<ResultJSON>(
      'malloy.runQueryFile'
    );
    assert.notStrictEqual(resultJson.queryResult.result, [{one: 1}]);
  });
});

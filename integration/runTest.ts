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

import * as path from 'path';

import {runTests} from '@vscode/test-electron';
import {TestOptions} from '@vscode/test-electron/out/runTest';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../..');

    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './tests/index');

    const testOptions: TestOptions = {
      extensionDevelopmentPath,
      extensionTestsPath,
    };

    if (process.env.NIX_STORE) {
      const executablePaths = process.env.PATH?.split(':');
      const vscodePath = executablePaths?.find(path =>
        path.match(/\/nix\/store\/.*-vscode-.*\/bin/)
      );
      if (vscodePath) {
        console.log('Found code path', vscodePath);
        const codeDir = vscodePath.substring(0, vscodePath.length - 4);
        testOptions.vscodeExecutablePath = codeDir + '/lib/vscode/code';
      }
    }

    if (process.getuid() === 0) {
      testOptions.launchArgs = ['--no-sandbox', '--user-data-dir=/tmp'];
    }

    await runTests(testOptions);
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as path from 'path';
import * as fs from 'fs';

import {runTests} from '@vscode/test-electron';
import {TestOptions} from '@vscode/test-electron/out/runTest';

const CLOUDBUILD_CODE = '/usr/share/code/code';

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

    if (fs.existsSync(CLOUDBUILD_CODE)) {
      testOptions.vscodeExecutablePath = CLOUDBUILD_CODE;
    }

    if (process.getuid?.() === 0) {
      testOptions.launchArgs = ['--no-sandbox', '--user-data-dir=/tmp'];
    }

    await runTests(testOptions);
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

void main();

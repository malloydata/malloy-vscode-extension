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

import {exec} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import duckdbPackage from '@malloydata/db-duckdb/package.json';

const DUCKDB_VERSION = (
  duckdbPackage.dependencies as Record<string, string>
)['@duckdb/node-api'];

export const targetDuckDBMap: Record<string, {os: string; cpu: string}> = {
  'darwin-arm64': {os: 'darwin', cpu: 'arm64'},
  'darwin-x64': {os: 'darwin', cpu: 'x64'},
  'linux-arm64': {os: 'linux', cpu: 'arm64'},
  'linux-x64': {os: 'linux', cpu: 'x64'},
  'win32-x64': {os: 'win32', cpu: 'x64'},
};

export const fetchDuckDB = async (target: string): Promise<void> => {
  console.log('Removing other architectures');
  Object.values(targetDuckDBMap).forEach(({os, cpu}) => {
    const dirName = path.resolve(
      'node_modules',
      '@duckdb',
      `node-bindings-${os}-${cpu}`
    );
    console.log(`Checking for ${dirName}`);
    if (fs.existsSync(dirName)) {
      console.log(`Removing ${dirName}`);
      fs.rmSync(dirName, {recursive: true, force: true});
    }
  });

  if (targetDuckDBMap[target]) {
    console.log(`Installing duckdb ${target} architecture`);

    const {os, cpu} = targetDuckDBMap[target];

    await new Promise<void>((resolve, reject) => {
      exec(
        `npm install --no-save --os ${os} --cpu ${cpu} --force @duckdb/node-bindings-${os}-${cpu}@${DUCKDB_VERSION}`,
        error => {
          if (error) {
            reject(error);
          }
          resolve();
        }
      );
    });
  }
};

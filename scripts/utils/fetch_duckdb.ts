/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {exec} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Read the installed @duckdb/node-api to find what node-bindings version it expects.
// This is the source of truth — node-api declares its dependency on node-bindings,
// and the platform-specific packages use the same version.
const nodeApiPkg = JSON.parse(
  fs.readFileSync(require.resolve('@duckdb/node-api/package.json'), 'utf-8')
);
const DUCKDB_BINDINGS_VERSION: string =
  nodeApiPkg.dependencies['@duckdb/node-bindings'];

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
        `npm install --no-save --os ${os} --cpu ${cpu} --force @duckdb/node-bindings-${os}-${cpu}@${DUCKDB_BINDINGS_VERSION}`,
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

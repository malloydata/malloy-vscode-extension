/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {spawn} from 'child_process';
import {Target} from './constants';

export async function publishOvsx(
  path: string,
  target: Target,
  preRelease: boolean
): Promise<number | null> {
  const token = process.env['OVSX_TOKEN'];
  if (!token) {
    console.log(`Skipping ovsx for ${path}`);
    return null;
  }

  const args = ['publish', path, '-p', token, '-t', target];

  if (preRelease) {
    args.push('--pre-release');
  }

  return new Promise<number | null>((resolve, reject) => {
    const child = spawn('./node_modules/.bin/ovsx', args)
      .on('exit', code => {
        if (code) {
          reject(new Error(`ovsx return ${code}`));
        }
        resolve(code);
      })
      .on('error', err => reject(err));

    child.stdout.on('data', (data: Buffer) => {
      console.log(data.toString());
    });
    child.stderr.on('data', (data: Buffer) => {
      console.error(data.toString());
    });
  });
}

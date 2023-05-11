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

import {spawn} from 'child_process';

export async function publishOvsx(
  path: string,
  preRelease: boolean
): Promise<number | null> {
  const token = process.env['OVSX_TOKEN'];
  if (!token) {
    console.log(`Skipping ovsx for ${path}`);
    return null;
  }

  const args = ['publish', path, '-p', token];

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

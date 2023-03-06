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

/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';

import extensionPackage from '../../package.json';
import {fetchNode} from './fetch_node';

const KEYTAR_VERSION = extensionPackage.dependencies.keytar;

export const targetKeytarMap: Record<string, string> = {
  'linux-x64': `keytar-v${KEYTAR_VERSION}-napi-v3-linux-x64`,
  'linux-arm64': `keytar-v${KEYTAR_VERSION}-napi-v3-linux-arm64`,
  'linux-armhf': `keytar-v${KEYTAR_VERSION}-napi-v3-linux-ia32`,
  'alpine-x64': `keytar-v${KEYTAR_VERSION}-napi-v3-linuxmusl-x64`,
  'alpine-arm64': `keytar-v${KEYTAR_VERSION}-napi-v3-linuxmusl-arm64`,
  'darwin-x64': `keytar-v${KEYTAR_VERSION}-napi-v3-darwin-x64`,
  'darwin-arm64': `keytar-v${KEYTAR_VERSION}-napi-v3-darwin-arm64`,
  'win32-x64': `keytar-v${KEYTAR_VERSION}-napi-v3-win32-x64`,
};

export const fetchKeytar = async (target: string): Promise<string> => {
  const file = targetKeytarMap[target];
  const url = `https://github.com/atom/node-keytar/releases/download/v${KEYTAR_VERSION}/${file}.tar.gz`;
  const directoryPath = path.resolve(
    path.join('third_party', 'github.com', 'atom', 'node-keytar')
  );
  fs.mkdirSync(directoryPath, {recursive: true});
  const filePath = path.join(directoryPath, `${file}.node`);

  await fetchNode(filePath, url);

  return filePath;
};

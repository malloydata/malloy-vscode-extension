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

import {URLReader} from '@malloydata/malloy';
import {CellData} from '../../common/types';
import {connection} from './connections_node';

/**
 * Requests a file from the worker's controller. Although the
 * file path is a file system path, reading the file off
 * disk doesn't take into account unsaved changes that only
 * VS Code is aware of.
 *
 * @param uri URI to resolve
 * @returns File contents
 */
export async function fetchFile(uri: string): Promise<string> {
  return connection.sendRequest('read', {uri}) as Promise<string>;
}

/**
 * Requests a binary file from the worker's controller.
 *
 * @param uri URI to resolve
 * @returns File contents
 */
export async function fetchFileBinary(uri: string): Promise<Uint8Array> {
  return connection.sendRequest('read_binary', {uri}) as Promise<Uint8Array>;
}

/**
 * Requests a set of cell data from the worker's controller.
 *
 * @param uri URI to resolve
 * @returns File contents
 */
export async function fetchCellData(uri: string): Promise<CellData[]> {
  return connection.sendRequest('read_cell_data', {uri}) as Promise<CellData[]>;
}

export class WorkerURLReader implements URLReader {
  async readURL(url: URL): Promise<string> {
    return fetchFile(url.toString());
  }
}

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

import {CancellationToken} from 'vscode-languageserver';
import {CellData, FileHandler} from '../common/types';

export interface CommonConnection {
  sendRequest<R>(
    method: string,
    params: any,
    token?: CancellationToken
  ): Promise<R>;
}

export class RpcFileHandler implements FileHandler {
  constructor(private connection: CommonConnection) {}

  /**
   * Requests a file from the worker's controller. Although the
   * file path is a file system path, reading the file off
   * disk doesn't take into account unsaved changes that only
   * VS Code is aware of.
   *
   * @param uri URI to resolve
   * @returns File contents
   */
  async fetchFile(uri: string): Promise<string> {
    return this.connection.sendRequest('malloy/fetch', {
      uri,
    }) as Promise<string>;
  }

  /**
   * Requests a binary file from the worker's controller.
   *
   * @param uri URI to resolve
   * @returns File contents
   */

  async fetchBinaryFile(uri: string): Promise<Uint8Array> {
    return this.connection.sendRequest('malloy/fetchBinary', {
      uri,
    }) as Promise<Uint8Array>;
  }

  /**
   * Requests a set of cell data from the worker's controller.
   *
   * @param uri URI to resolve
   * @returns File contents
   */
  async fetchCellData(uri: string): Promise<CellData[]> {
    return this.connection.sendRequest('malloy/fetchCellData', {
      uri,
    }) as Promise<CellData[]>;
  }

  async readURL(url: URL): Promise<string> {
    return this.fetchFile(url.toString());
  }
}

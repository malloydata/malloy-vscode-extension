/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {CellData, FileHandler} from '../common/types/file_handler';
import {WorkerMessageHandler} from '../common/types/worker_message_types';

export class RpcFileHandler implements FileHandler {
  constructor(private connection: WorkerMessageHandler) {}

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
    });
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
    });
  }

  /**
   * Requests a set of cell data from the worker's controller.
   *
   * @param uri URI to resolve
   * @returns File contents
   */
  async fetchCellData(uri: string): Promise<CellData> {
    return this.connection.sendRequest('malloy/fetchCellData', {
      uri,
    });
  }

  async readURL(url: URL): Promise<string> {
    return this.fetchFile(url.toString());
  }

  /**
   * Requests workspace directories from the worker's controller.
   *
   * @param uri URI to resolve
   * @returns workspace directories as an array of URI strings
   */
  async fetchWorkspaceFolders(uri: string): Promise<string[]> {
    return this.connection.sendRequest('malloy/fetchWorkspaceFolders', {uri});
  }
}

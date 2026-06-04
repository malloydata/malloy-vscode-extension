/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {URLReader} from '@malloydata/malloy';

export interface FetchFileEvent {
  uri: string;
}

export interface FetchBinaryFileEvent {
  uri: string;
}

export interface FetchCellDataEvent {
  uri: string;
}

export interface CellMetadataConfig {
  [key: string]: unknown;
  connection?: string;
}

export interface QueryCost {
  queryCostBytes: number;
  isEstimate: boolean;
}

export interface CellMetadata {
  [key: string]: unknown;
  config?: CellMetadataConfig;
  cost?: QueryCost;
}

export interface Cell {
  uri: string;
  text: string;
  languageId: string;
  metadata?: CellMetadata;
  /** Starting line of this cell's content in the notebook file (0-indexed) */
  lineOffset: number;
}
export interface CellData {
  baseUri: string;
  cells: Cell[];
}

export interface BuildModelRequest {
  uri: string;
  languageId: string;
  refreshSchemaCache?: boolean;
}

export interface FileHandler extends URLReader {
  /**
   * Requests a file from the worker's controller. Although the
   * file path is a file system path, reading the file off
   * disk doesn't take into account unsaved changes that only
   * VS Code is aware of.
   *
   * @param uri URI to resolve
   * @returns File contents
   */
  fetchFile(uri: string): Promise<string>;
  /**
   * Requests a binary file from the worker's controller.
   *
   * @param uri URI to resolve
   * @returns File contents
   */

  fetchBinaryFile(uri: string): Promise<Uint8Array>;

  /**
   * Requests a set of cell data from the worker's controller.
   *
   * @param uri URI to resolve
   * @returns File contents
   */
  fetchCellData(uri: string): Promise<CellData>;

  /**
   * Requests workspace directories from the worker's controller.
   *
   * @param uri URI to resolve
   * @returns workspace directories as an array of URI strings
   */
  fetchWorkspaceFolders(uri: string): Promise<string[]>;
}

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export interface DocumentMetadata {
  fileName: string;
  uri: string;
  languageId: string;
  version: number;
}

export interface NamedQuerySpec {
  type: 'named';
  name: string;
  documentMeta: DocumentMetadata;
}

export interface QueryStringSpec {
  type: 'string';
  text: string;
  documentMeta: DocumentMetadata;
}

export interface QueryFileSpec {
  type: 'file';
  index?: number;
  exploreName?: string;
  documentMeta: DocumentMetadata;
}

export type QuerySpec = NamedQuerySpec | QueryStringSpec | QueryFileSpec;

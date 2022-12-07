/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { TextDocument } from "vscode-languageserver-textdocument";
import { Malloy } from "@malloydata/malloy";

// TODO(whscullin): Export Parse from Malloy
type Parse = ReturnType<typeof Malloy.parse>;

const PARSE_CACHE = new Map<string, { parsed: Parse; version: number }>();

export const parseWithCache = (document: TextDocument): Parse => {
  const { version, uri } = document;

  const entry = PARSE_CACHE.get(uri);
  if (entry && entry.version === version) {
    return entry.parsed;
  }

  const parsed = Malloy.parse({ source: document.getText() });
  PARSE_CACHE.set(uri, { parsed, version });
  return parsed;
};

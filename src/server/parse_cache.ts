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

import {TextDocument} from 'vscode-languageserver-textdocument';
import {Malloy, Parse} from '@malloydata/malloy';
import {
  MalloySQLParse,
  MalloySQLParser,
  MalloySQLSQLParse,
  MalloySQLSQLParser,
} from '@malloydata/malloy-sql';

const PARSE_CACHE = new Map<string, {parsed: Parse; version: number}>();
const MALLOYSQL_PARSE_CACHE = new Map<
  string,
  {parsed: MalloySQLParse; version: number}
>();
const MALLOYSQLSQL_PARSE_CACHE = new Map<
  string,
  {parsed: MalloySQLSQLParse; version: number}
>();

export const parseWithCache = (document: TextDocument): Parse => {
  const {version, uri} = document;

  const entry = PARSE_CACHE.get(uri);
  if (entry && entry.version === version) {
    return entry.parsed;
  }

  const parsed = Malloy.parse({source: document.getText()});
  PARSE_CACHE.set(uri, {parsed, version});
  return parsed;
};

export const parseMalloySQLWithCache = (
  document: TextDocument
): MalloySQLParse => {
  const {version, uri} = document;

  const entry = MALLOYSQL_PARSE_CACHE.get(uri);
  if (entry && entry.version === version) {
    return entry.parsed;
  }

  const parsed = MalloySQLParser.parse(document.getText(), uri);
  MALLOYSQL_PARSE_CACHE.set(uri, {parsed, version});
  return parsed;
};

export const parseMalloySQLSQLWithCache = (
  document: TextDocument
): MalloySQLSQLParse => {
  const {version, uri} = document;

  const entry = MALLOYSQLSQL_PARSE_CACHE.get(uri);
  if (entry && entry.version === version) {
    return entry.parsed;
  }

  const parsed = MalloySQLSQLParser.parse(document.getText(), uri);
  MALLOYSQLSQL_PARSE_CACHE.set(uri, {parsed, version});
  return parsed;
};

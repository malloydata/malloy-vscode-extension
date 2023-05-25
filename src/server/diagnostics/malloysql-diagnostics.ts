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

import {Diagnostic, DiagnosticSeverity} from 'vscode-languageserver';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {MalloySQLParser} from '@malloydata/malloy-sql';
import {TranslateCache} from '../translate_cache';
import {MalloyError} from '@malloydata/malloy';

const DEFAULT_RANGE = {
  start: {line: 0, character: 0},
  end: {line: 0, character: Number.MAX_VALUE},
};
// TODO caching
export async function getMalloySQLDiagnostics(
  translateCache: TranslateCache,
  document: TextDocument
): Promise<{[uri: string]: Diagnostic[]}> {
  const byURI: {[uri: string]: Diagnostic[]} = {
    // Important that the requested document starts out as empty array,
    // so that we clear old diagnostics
    [document.uri]: [],
  };

  let errors = [];

  const parse = await MalloySQLParser.parse(document.getText());
  if (parse.errors) errors.push(...parse.errors);
  try {
    await translateCache.translateWithCache(document.uri, document.version);
  } catch (error) {
    if (error instanceof MalloyError) {
      errors = error.log;
    } else {
      // TODO this kind of error should cease to exist. All errors should have source info.
      byURI[document.uri].push({
        severity: DiagnosticSeverity.Error,
        range: DEFAULT_RANGE,
        message: error.message,
        source: 'malloy',
      });
    }
  }

  for (const err of errors) {
    const sev =
      err.severity === 'warn'
        ? DiagnosticSeverity.Warning
        : err.severity === 'debug'
        ? DiagnosticSeverity.Information
        : DiagnosticSeverity.Error;

    const uri = err.at ? err.at.url : document.uri;

    if (byURI[uri] === undefined) {
      byURI[uri] = [];
    }

    const range = err.at
      ? err.at.range
      : {
          start: {
            line: err.range.start.line,
            character: err.range.start.column,
          },
          end: {
            line: err.range.end.line,
            character: err.range.end.column,
          },
        };

    if (range.start.line >= 0) {
      byURI[uri].push({
        severity: sev,
        range,
        message: err.message,
        source: 'malloy',
      });
    }
  }

  return byURI;
}

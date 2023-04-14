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

import {
  Diagnostic,
  DiagnosticSeverity,
  TextDocuments,
} from 'vscode-languageserver';
import {LogMessage, MalloyError} from '@malloydata/malloy';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {ConnectionManager} from '../../common/connection_manager';
import {TranslateCache} from '../translate_cache';

const DEFAULT_RANGE = {
  start: {line: 0, character: 0},
  end: {line: 0, character: Number.MAX_VALUE},
};

export async function getMalloyDiagnostics(
  translateCache: TranslateCache,
  connectionManager: ConnectionManager,
  documents: TextDocuments<TextDocument>,
  document: TextDocument
): Promise<{[uri: string]: Diagnostic[]}> {
  const byURI: {[uri: string]: Diagnostic[]} = {
    // Important that the requested document starts out as empty array,
    // so that we clear old diagnostics
    [document.uri]: [],
  };
  let errors: LogMessage[] = [];

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

    const range = err.at?.range || DEFAULT_RANGE;

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

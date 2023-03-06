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
import {TranslateCache} from '../types';
import {DocumentRange} from '@malloydata/malloy/dist/model/malloy_types';
import {
  DocumentPosition,
  DocumentRange as DocumentRangeImpl,
} from '@malloydata/malloy/dist/malloy';

const DEFAULT_RANGE = {
  start: {line: 0, character: 0},
  end: {line: 0, character: Number.MAX_VALUE},
};

const massageRange = (
  range: DocumentRange | undefined,
  delta: number
): DocumentRange | undefined => {
  if (!range) {
    return range;
  }

  return new DocumentRangeImpl(
    new DocumentPosition(range.start.line + delta, range.start.character),
    new DocumentPosition(range.end.line + delta, range.end.character)
  );
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

  const text = await translateCache.getDocumentText(
    documents,
    new URL(document.uri.toString())
  );
  // Try and determine the offset into a cell instead of the whole
  // document if we're in a notebook
  let delta = 0;
  const parts = text.split(/\n\/\/ --! cell .*\n/);
  if (parts.length > 1) {
    // Remove the last entry
    parts.pop();
    for (const part of parts) {
      const lines = part.split('\n');
      delta += lines.length + 1; // body + header
    }
  }

  try {
    await translateCache.translateWithCache(
      connectionManager,
      document,
      documents
    );
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

    const range = massageRange(err.at?.range, -delta) || DEFAULT_RANGE;

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

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
import {LogMessage, MalloyError} from '@malloydata/malloy';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {TranslateCache} from '../translate_cache';
import {
  parseMalloySQLWithCache,
  parseMalloySQLSQLWithCache,
} from '../parse_cache';
import {errorMessage} from '../../common/errors';

const DEFAULT_RANGE = {
  start: {line: 0, character: 0},
  end: {line: 0, character: Number.MAX_VALUE},
};

export async function getMalloyDiagnostics(
  translateCache: TranslateCache,
  document: TextDocument
): Promise<{[uri: string]: Diagnostic[]}> {
  const byURI: {[uri: string]: Diagnostic[]} = {
    // Important that the requested document starts out as empty array,
    // so that we clear old diagnostics
    [document.uri]: [],
  };
  const problems: LogMessage[] = [];

  if (document.languageId === 'malloy-sql') {
    const {errors} = parseMalloySQLSQLWithCache(document);
    if (errors) errors.forEach(e => problems.push(...e.problems));
  } else if (document.languageId === 'malloy-notebook') {
    // TODO(whscullin): Delete with malloy-sql text editor
    const {errors} = parseMalloySQLWithCache(document);
    if (errors) errors.forEach(e => problems.push(...e.problems));
  }

  try {
    const model = await translateCache.translateWithCache(
      document.uri,
      document.version,
      document.languageId
    );
    if (model?.problems) {
      problems.push(...model.problems);
    }
  } catch (error) {
    if (error instanceof MalloyError) {
      problems.push(...error.problems);
    } else {
      // TODO this kind of error should cease to exist. All errors should have source info.
      byURI[document.uri].push({
        severity: DiagnosticSeverity.Error,
        range: DEFAULT_RANGE,
        message: errorMessage(error),
        source: 'malloy',
      });
    }
  }

  for (const problem of problems) {
    const sev =
      problem.severity === 'warn'
        ? DiagnosticSeverity.Warning
        : problem.severity === 'debug'
        ? DiagnosticSeverity.Information
        : DiagnosticSeverity.Error;

    const uri = problem.at ? problem.at.url : document.uri;

    if (byURI[uri] === undefined) {
      byURI[uri] = [];
    }

    const range = problem.at?.range || DEFAULT_RANGE;

    if (range.start.line >= 0) {
      byURI[uri].push({
        severity: sev,
        range,
        message: problem.message,
        source: 'malloy',
      });
    }
  }

  return byURI;
}

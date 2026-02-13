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
import {parseMalloySQLSQLWithCache} from '../parse_cache';
import {errorMessage} from '../../common/errors';
import {prettyLogUri} from '../../common/log';
const errorDictURI =
  'https://docs.malloydata.dev/documentation/error_dictionary';

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
  }

  try {
    const model = await translateCache.translateWithCache(
      document.uri,
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
      const theDiag: Diagnostic = {
        severity: sev,
        range,
        message: problem.message,
        source: 'malloy',
      };
      if (problem.errorTag) {
        theDiag.code = problem.errorTag;
        theDiag.codeDescription = {href: `${errorDictURI}#${theDiag.code}`};
      }
      byURI[uri].push(theDiag);
    }
  }

  console.info(
    `getMalloyDiagnostics: ${prettyLogUri(document.uri)} found ${
      problems.length
    } problems`
  );

  return byURI;
}

/**
 * Aggregates notebook cell diagnostics to the notebook file URI.
 * This allows external tools (like Cursor) that query by file URI
 * to see diagnostics for notebook cells.
 *
 * @param diagnostics Diagnostics keyed by URI (may include cell URIs)
 * @param translateCache Cache for fetching cell data with line offsets
 * @returns Diagnostics aggregated by notebook file URI with adjusted line numbers
 */
export async function aggregateNotebookDiagnostics(
  diagnostics: {[uri: string]: Diagnostic[]},
  translateCache: TranslateCache
): Promise<{[notebookUri: string]: Diagnostic[]}> {
  const result: {[uri: string]: Diagnostic[]} = {};

  for (const [uri, diags] of Object.entries(diagnostics)) {
    let url: URL;
    try {
      url = new URL(uri);
    } catch {
      continue; // Skip invalid URIs
    }

    // Only process notebook cell URIs
    if (url.protocol !== 'vscode-notebook-cell:') continue;

    // Convert cell URI to file URI (same path, file: scheme)
    const notebookUri = `file://${url.pathname}`;

    // Always initialize the notebook entry (even if empty) to clear old diagnostics
    if (!result[notebookUri]) {
      result[notebookUri] = [];
    }

    // Skip further processing if no diagnostics for this cell
    if (diags.length === 0) continue;

    try {
      // Get cell data to find line offset
      const cellData = await translateCache.getCellData(url);
      const cell = cellData.cells.find(c => c.uri === uri);
      const lineOffset = cell?.lineOffset ?? 0;

      // Map diagnostics with adjusted line numbers
      const mappedDiags = diags.map(d => ({
        ...d,
        range: {
          start: {
            line: d.range.start.line + lineOffset,
            character: d.range.start.character,
          },
          end: {
            line: d.range.end.line + lineOffset,
            character: d.range.end.character,
          },
        },
      }));

      // Aggregate diagnostics for this notebook
      result[notebookUri].push(...mappedDiags);
    } catch (error) {
      console.error(
        `Failed to aggregate diagnostics for notebook cell ${uri}:`,
        error
      );
    }
  }

  return result;
}

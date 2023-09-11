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

// TODO(whscullin): Delete with malloy-sql text editor

import {CodeLens, Command, Range, Position} from 'vscode-languageserver/node';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {parseMalloySQLWithCache} from '../parse_cache';

export function getMalloySQLLenses(document: TextDocument): CodeLens[] {
  const parse = parseMalloySQLWithCache(document);

  const runAll: Command = {
    command: 'malloy.runMalloySQLFile',
    title: 'Run All Statements',
  };

  const compileSQLAll: Command = {
    command: 'malloy.showSQLMalloySQLFile',
    title: 'Compile All Statements',
  };

  const lenses: CodeLens[] = [];
  for (const statement of parse.statements) {
    lenses.push({
      range: Range.create(
        Position.create(
          statement.delimiterRange.start.line + 1,
          statement.delimiterRange.start.character
        ),
        Position.create(
          statement.delimiterRange.end.line + 1,
          statement.delimiterRange.end.character
        )
      ),
      command: {
        command: 'malloy.runMalloySQLStatement',
        title: 'Run',
        arguments: [statement.index],
      },
    });
  }

  return [
    {range: Range.create(0, 0, 0, 0), command: runAll},
    {range: Range.create(0, 0, 0, 0), command: compileSQLAll},
    ...lenses,
  ];
}

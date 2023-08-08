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

import {CodeLens, Position, Range} from 'vscode-languageserver/node';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {parseWithCache} from '../parse_cache';

// const explain = `
//   index
//   | reduce  : [
//       field_value: != null,
//     ]
//     strings is (reduce order by 2 : [field_type: 'string']
//       field_name
//       cardinality is count(distinct field_value)
//       top_values_list is (reduce order by 2 desc top 20
//         field_value
//         occurrences is weight
//       )
//     )
//     other_types is (reduce : [field_type: != 'string']
//       field_name
//       field_type
//       field_value
//     )
// `;

export function getMalloyLenses(document: TextDocument): CodeLens[] {
  const lenses: CodeLens[] = [];
  const symbols = parseWithCache(document).symbols;

  let currentUnnamedQueryIndex = 0;
  let currentUnnamedSQLBlockIndex = 0;
  symbols.forEach(symbol => {
    if (symbol.type === 'query') {
      lenses.push(
        {
          range: symbol.lensRange.toJSON(),
          command: {
            title: 'Run Query',
            command: 'malloy.runNamedQuery',
            arguments: [symbol.name],
          },
        },
        {
          range: symbol.lensRange.toJSON(),
          command: {
            title: 'Show SQL',
            command: 'malloy.showSQLNamedQuery',
            arguments: [symbol.name],
          },
        }
      );
    } else if (symbol.type === 'unnamed_query') {
      lenses.push(
        {
          range: symbol.lensRange.toJSON(),
          command: {
            title: 'Run Query',
            command: 'malloy.runQueryFile',
            arguments: [currentUnnamedQueryIndex],
          },
        },
        {
          range: symbol.lensRange.toJSON(),
          command: {
            title: 'Show SQL',
            command: 'malloy.showSQLFile',
            arguments: [currentUnnamedQueryIndex],
          },
        }
      );
      currentUnnamedQueryIndex++;
    } else if (symbol.type === 'explore') {
      const children = symbol.children;
      const exploreName = symbol.name;
      lenses.push({
        range: symbol.lensRange.toJSON(),
        command: {
          title: 'Preview',
          command: 'malloy.runQuery',
          arguments: [
            `query: ${exploreName}->{ project: *; limit: 20 }`,
            `preview ${exploreName}`,
          ],
        },
      });
      // lenses.push({
      //   range: symbol.range.toJSON(),
      //   command: {
      //     title: "Explain",
      //     command: "malloy.runQuery",
      //     arguments: [
      //       `query: ${exploreName}->${explain}`,
      //       `explain ${exploreName}`,
      //     ],
      //   },
      // });
      children.forEach(child => {
        if (child.type === 'query') {
          const queryName = child.name;
          lenses.push(
            {
              range: child.lensRange.toJSON(),
              command: {
                title: 'Run Query',
                command: 'malloy.runQuery',
                arguments: [
                  `query: ${exploreName}->${queryName}`,
                  `${exploreName}->${queryName}`,
                ],
              },
            },
            {
              range: child.lensRange.toJSON(),
              command: {
                title: 'Show SQL',
                command: 'malloy.showSQL',
                arguments: [
                  `query: ${exploreName}->${queryName}`,
                  `${exploreName}->${queryName}`,
                ],
              },
            }
          );
        }
      });
    } else if (symbol.type === 'sql') {
      lenses.push({
        range: symbol.lensRange.toJSON(),
        command: {
          title: 'Run',
          command: 'malloy.runNamedSQLBlock',
          arguments: [symbol.name],
        },
      });
      // TODO feature-sql-block Currently, named SQL blocks are not in the model, but stored
      //      in the same list alongside unnaed SQL blocks. This is unlike the way queries work:
      //      named queries exist in the model, and unnamed queries exist outside the model in
      //      a separate list. Anyway, this means that at the moment, _named_ SQL blocks are also
      //      indexable.
      currentUnnamedSQLBlockIndex++;
    } else if (symbol.type === 'unnamed_sql') {
      lenses.push({
        range: symbol.lensRange.toJSON(),
        command: {
          title: 'Run',
          command: 'malloy.runUnnamedSQLBlock',
          arguments: [currentUnnamedSQLBlockIndex],
        },
      });
      currentUnnamedSQLBlockIndex++;
    }
  });

  return lenses;
}

function inRange(range: Range, position: Position): boolean {
  const {start, end} = range;
  const afterStart =
    position.line > start.line ||
    (position.line === start.line && position.character >= start.character);
  const beforeEnd =
    position.line < end.line ||
    (position.line === end.line && position.character <= end.character);
  return afterStart && beforeEnd;
}

export function findMalloyLensesAt(
  document: TextDocument,
  position: Position
): CodeLens[] {
  const lenses = getMalloyLenses(document);

  return lenses.filter(lens => inRange(lens.range, position));
}

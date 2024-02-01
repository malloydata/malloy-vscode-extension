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

import {CodeLens, Connection, Position, Range} from 'vscode-languageserver';
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

/**
 * Transforms vscode-notebook-cell: Uris to file: or vscode-vfs: URLS
 * based on the workspace, because VS Code can't use a vscode-notebook-cell:
 * as a relative url for non-cells, like external Malloy files.
 *
 * @param uri Document uri
 * @returns Uri with an appropriate protocol
 */
const fixNotebookUrl = async (connection: Connection, url: URL) => {
  if (url.protocol === 'vscode-notebook-cell:') {
    let protocol = 'file:';
    const workspaceFolders = await connection.workspace.getWorkspaceFolders();
    if (workspaceFolders && workspaceFolders[0]) {
      protocol = new URL(workspaceFolders[0].uri).protocol;
    }
    const {pathname, search} = url;
    const host = protocol === 'file:' ? '' : url.host;
    const urlString = `${protocol}//${host}${pathname}${search}`;
    url = new URL(urlString);
  }

  return url;
};

export async function getMalloyLenses(
  connection: Connection,
  document: TextDocument
): Promise<CodeLens[]> {
  const lenses: CodeLens[] = [];
  const symbols = parseWithCache(document).symbols;

  let currentUnnamedQueryIndex = 0;
  let currentUnnamedSQLBlockIndex = 0;
  for (const symbol of symbols) {
    switch (symbol.type) {
      case 'query':
        lenses.push(
          {
            range: symbol.lensRange.toJSON(),
            command: {
              title: 'Run',
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
        break;
      case 'unnamed_query':
        lenses.push(
          {
            range: symbol.lensRange.toJSON(),
            command: {
              title: 'Run',
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
        break;
      case 'explore':
        {
          const children = symbol.children;
          const exploreName = symbol.name;
          lenses.push({
            range: symbol.lensRange.toJSON(),
            command: {
              title: 'Schema',
              command: 'malloy.runQuery',
              arguments: [
                `run: ${exploreName}->{ select: *; limit: 20 }`,
                `Preview ${exploreName}`,
                'schema',
              ],
            },
          });
          lenses.push({
            range: symbol.lensRange.toJSON(),
            command: {
              title: 'Preview',
              command: 'malloy.runQuery',
              arguments: [
                `run: ${exploreName}->{ select: *; limit: 20 }`,
                `Preview ${exploreName}`,
                'preview',
              ],
            },
          });
          // lenses.push({
          //   range: symbol.range.toJSON(),
          //   command: {
          //     title: "Explain",
          //     command: "malloy.runQuery",
          //     arguments: [
          //       `run: ${exploreName}->${explain}`,
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
                    title: 'Run',
                    command: 'malloy.runQuery',
                    arguments: [
                      `run: ${exploreName}->${queryName}`,
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
                      `run: ${exploreName}->${queryName}`,
                      `${exploreName}->${queryName}`,
                    ],
                  },
                }
              );
            }
          });
        }
        break;
      case 'sql':
        lenses.push({
          range: symbol.lensRange.toJSON(),
          command: {
            title: 'Run',
            command: 'malloy.runNamedSQLBlock',
            arguments: [symbol.name],
          },
        });
        // TODO feature-sql-block Currently, named SQL blocks are not in the model, but stored
        //      in the same list alongside unnamed SQL blocks. This is unlike the way queries work:
        //      named queries exist in the model, and unnamed queries exist outside the model in
        //      a separate list. Anyway, this means that at the moment, _named_ SQL blocks are also
        //      indexable.
        currentUnnamedSQLBlockIndex++;
        break;
      case 'unnamed_sql':
        lenses.push({
          range: symbol.lensRange.toJSON(),
          command: {
            title: 'Run',
            command: 'malloy.runUnnamedSQLBlock',
            arguments: [currentUnnamedSQLBlockIndex],
          },
        });
        currentUnnamedSQLBlockIndex++;
        break;
      case 'import':
        try {
          const documentUrl = new URL(document.uri);
          const url = await fixNotebookUrl(
            connection,
            new URL(symbol.name, documentUrl)
          );
          lenses.push({
            range: symbol.lensRange.toJSON(),
            command: {
              title: 'Schemas: all',
              command: 'malloy.showSchemaFile',
              arguments: [url.toString()],
            },
          });
          for (const child of symbol.children) {
            lenses.push({
              range: child.lensRange.toJSON(),
              command: {
                title: child.name,
                command: 'malloy.runQuery',
                arguments: [
                  `run: ${child.name}->{ select: *; limit: 20 }`,
                  `Preview ${child.name}`,
                  'schema',
                  symbol.name,
                ],
              },
            });
          }
        } catch (e) {
          console.error('import code lens failed with', e);
        }
        break;
    }
  }

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

export async function findMalloyLensesAt(
  connection: Connection,
  document: TextDocument,
  position: Position
): Promise<CodeLens[]> {
  const lenses = await getMalloyLenses(connection, document);

  return lenses.filter(lens => inRange(lens.range, position));
}

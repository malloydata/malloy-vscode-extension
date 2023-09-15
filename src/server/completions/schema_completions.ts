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

import {CompletionParams} from 'vscode-languageserver/node';
import {Position, TextDocument} from 'vscode-languageserver-textdocument';
import {TranslateCache} from '../translate_cache';
import {Explore, Field, Model} from '@malloydata/malloy';
import {fieldType, isFieldAggregate} from '../../common/schema';

/**
 * Keywords that are followed by a colon within queries
 */
const QUERY_KEYWORDS = [
  'aggregate',
  'calculate',
  'group_by',
  'having',
  'index',
  'limit',
  'order_by',
  'project',
  'sample',
  'top',
  'where',
  'timezone',
];

/**
 * A regex used to identify the nearest keywords followed by a colon found within
 * queries, used to identify which field types to suggest
 */
const KEYWORDS = new RegExp(`\\b(?:${QUERY_KEYWORDS.join('|')}):`, 'gi');

/**
 * A regex to determine if the current line contains
 */
const UNNAMED_QUERY =
  /\b(?:run|query)\s*:\s*([A-Za-z_][A-Za-z_0-9]*)\s*->\s*{/gi;
const NAMED_QUERY =
  /\bquery\s*:\s*(?:[A-Za-z_][A-Za-z_0-9]*)\s+is\s+([A-Za-z_][A-Za-z_0-9]*)\s+->\s*{/gi;
const FIELD_CHAIN = /\s(?:[a-zA-Z_][.A-Za-z_0-9]*)?$/g;
const TOP_LEVEL_SYMBOLS = /\s*((?:source|query|run|sql)\s*:|import)\s*/gi;
const LINE_COMMENTS = /\s*(--|\/\/)/g;

export async function getSchemaCompletions(
  document: TextDocument,
  context: CompletionParams,
  translateCache: TranslateCache
): Promise<string[]> {
  const parse = parseDocumentText(document.getText(), context.position);
  if (parse.nearestDefinitionText && parse.adjustedCursor) {
    const exploreName = getQueriedExploreName(parse.nearestDefinitionText);
    const {keyword, fieldChain} = getQueryContext(
      parse.nearestDefinitionText,
      parse.adjustedCursor
    );
    if (exploreName !== null && keyword !== null && fieldChain !== null) {
      let model: Model | undefined = undefined;
      try {
        model = await translateCache.translateWithTruncatedCache(
          document,
          parse.truncatedText,
          parse.exploreCount
        );
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error(
          `Error fetching model for document sources and imports '${__filename}': ${error}`
        );
      }
      if (model) {
        const exploreMap: Record<string, Explore> = {};
        model.explores.forEach(explore => {
          exploreMap[explore.name] = explore;
        });
        if (exploreMap[exploreName]) {
          const fields = getEligibleFields(
            fieldChain,
            exploreMap[exploreName],
            exploreMap
          );
          return filterCompletions(fields, keyword, fieldChain);
        }
      }
    }
  }
  return [];
}

function getQueriedExploreName(text: string[]): string | null {
  const unnamedQueryMatch = UNNAMED_QUERY.exec(text[0]);
  if (unnamedQueryMatch) {
    return unnamedQueryMatch[1];
  }
  const namedQueryMatch = NAMED_QUERY.exec(text[0]);
  return namedQueryMatch ? namedQueryMatch[1] : null;
}

function getQueryContext(lines: string[], cursor: Position) {
  lines[cursor.line] = lines[cursor.line].slice(0, cursor.character);
  const fieldChainMatch = FIELD_CHAIN.exec(lines[cursor.line]);
  const fieldChain: string | null = fieldChainMatch
    ? fieldChainMatch[0].trim()
    : null;
  let i = cursor.line;
  let keyword: string | null = null;

  while (i >= 0) {
    const currentLine = lines[i];
    const matches = currentLine.match(KEYWORDS);
    if (matches) {
      keyword = matches[matches.length - 1]
        .slice(0, matches[matches.length - 1].length - 1)
        .toLowerCase();
      break;
    }
    i--;
  }
  return {keyword, fieldChain};
}

function getEligibleFields(
  fieldChain: string,
  explore: Explore,
  exploreMap: Record<string, Explore>
): Field[] {
  const fieldTree = fieldChain.split('.');
  fieldTree.pop();
  let currentExplore = explore;
  for (const fieldName of fieldTree) {
    if (fieldName.length === 0) {
      return [];
    }
    let validField = false;
    for (const field of currentExplore.allFields) {
      if (fieldName === field.name && field.isExploreField()) {
        validField = true;
        currentExplore = exploreMap[field.name];
        break;
      }
    }
    if (!validField) {
      return [];
    }
  }
  return currentExplore.allFields;
}

function filterCompletions(
  fields: Field[],
  keyword: string,
  fieldChain: string
) {
  const fieldTree = fieldChain.split('.');
  const eligibleFieldsPrefix = fieldTree[fieldTree.length - 1];
  const {dimensions, explores} = bucketMatchingFieldNames(
    fields,
    eligibleFieldsPrefix
  );
  if (keyword === 'group_by') {
    return [...dimensions, ...explores];
  } else {
    return [];
  }
}

function bucketMatchingFieldNames(fields: Field[], fieldToMatch: string) {
  const queries: string[] = [];
  const dimensions: string[] = [];
  const measures: string[] = [];
  const explores: string[] = [];
  for (const field of fields) {
    if (fieldToMatch.length === 0 || field.name.startsWith(fieldToMatch)) {
      const type = fieldType(field);
      if (isFieldAggregate(field)) {
        measures.push(field.name);
      } else if (field.isExploreField()) {
        explores.push(field.name);
      } else if (type === 'query') {
        queries.push(field.name);
      } else {
        dimensions.push(field.name);
      }
    }
  }
  return {queries, dimensions, measures, explores};
}

export interface DocumentTextParse {
  /**
   * Document text containing `Explore`s except for anonymous query-level source definitions
   *  - includes all unaltered imports
   *  - includes all unaltered source definitions
   */
  truncatedText: string;
  /**
   * Number of top-level imports and source definitions
   */
  exploreCount: number;
  /**
   * Document text for only the top-level definition that the cursor currently resides in
   * or nearest to, undefined if cursor is definitely not within a top-level definition
   */
  nearestDefinitionText?: string[];
  /**
   * The adjusted cursor position within the nearest top-level definition text as stored in
   * `nearestSymbolText`, undefined if cursor is not inside a top-level definition
   */
  adjustedCursor?: Position;
}

export function parseDocumentText(
  text: string,
  cursor: Position
): DocumentTextParse {
  const parse: DocumentTextParse = {
    truncatedText: '',
    exploreCount: 0,
  };
  const truncatedLines: string[] = [];

  let lastSymbolStart: Position | undefined = undefined;
  let lastNonemptyLine = -1;
  let includeLines = false;

  const lines = text.split('\n');
  for (const [i, line] of lines.entries()) {
    const symbolMatches = TOP_LEVEL_SYMBOLS.exec(line);
    if (symbolMatches !== null && symbolMatches.index === 0) {
      if (
        symbolMatches[1].toLowerCase().startsWith('source') ||
        symbolMatches[1].toLowerCase().startsWith('import')
      ) {
        includeLines = true;
        parse.exploreCount++;
      } else {
        includeLines = false;
      }
      parseCurrentDefinition(
        lastSymbolStart,
        cursor,
        lastNonemptyLine,
        parse,
        lines
      );
      lastSymbolStart = {
        line: i,
        character: symbolMatches.index,
      };
    }
    if (includeLines) {
      truncatedLines.push(line);
    }
    if (!isEmptyLine(line)) {
      lastNonemptyLine = i;
    }
  }
  parseCurrentDefinition(
    lastSymbolStart,
    cursor,
    lastNonemptyLine,
    parse,
    lines
  );
  parse.truncatedText = truncatedLines.join('\n');
  return parse;
}

function parseCurrentDefinition(
  lastSymbolStart: Position | undefined,
  cursor: Position,
  lastNonemptyLine: number,
  parse: DocumentTextParse,
  lines: string[]
) {
  if (
    lastSymbolStart &&
    cursor.line >= lastSymbolStart.line &&
    cursor.line <= lastNonemptyLine
  ) {
    parse.nearestDefinitionText = lines.slice(
      lastSymbolStart.line,
      lastNonemptyLine + 1
    );
    parse.adjustedCursor = {
      line: cursor.line - lastSymbolStart.line,
      character: cursor.character,
    };
  }
}

function isEmptyLine(line: string) {
  const commentMatches = LINE_COMMENTS.exec(line);
  return (commentMatches && commentMatches.index === 0) || line.length === 0;
}

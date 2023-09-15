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
 * When the nearest keyword is one of these, dimensions are suggested
 *
 * Note the inclusion of 'aggregate' and 'having' which should only apply
 * to measures, however aggregates can be defined in-line from dimensions
 *
 * In the future, an easy way to determine whether a user is in the middle of
 * defining an aggregate is to look for the 'is' keyword between the cursor
 * and the 'aggregate' or 'having' keyword
 */
const DIMENSION_KEYWORDS = [
  'project',
  'group_by',
  'order_by',
  'aggregate',
  'having',
  'order_by',
];

/**
 * When the nearest keyword is on these, measures are suggested
 */
const MEASURE_KEYWORDS = ['aggregate', 'having'];

/**
 * When the nearest keyword is one of these, explores are suggested
 *
 * For now, We do not walk the entire chain for each explore to
 * determine if it defines any measures later on in the chain, thus this
 * applies in all contexts where dimensions or measures could be used
 */
const EXPLORE_KEYWORDS = [
  'project',
  'group_by',
  'order_by',
  'aggregate',
  'having',
  'order_by',
];

/**
 * Regex for the beginning of a named query on a pre-defined source that is not extended
 */
const UNNAMED_QUERY =
  /\b(?:run|query)\s*:\s*([A-Za-z_][A-Za-z_0-9]*)\s*->\s*{/i;

/**
 * Regex for the beginning of a unnamed query on a pre-defined source that is not extended
 */
const NAMED_QUERY =
  /\bquery\s*:\s*(?:[A-Za-z_][A-Za-z_0-9]*)\s+is\s+([A-Za-z_][A-Za-z_0-9]*)\s+->\s*{/i;

/**
 * Regex to roughly identify a "chain" of dot-separated identifiers that users write in order
 * to access joined sources and fields from those joined sources
 *
 * For example, 'aircraft.aircraft_models.se' and 'aircraft.' would be considered
 * field chains
 *
 * For performance reasons, this regex is a rough approximation of what can parse as an
 * identifier, but `getEligibleFields` safely handles this approximation more efficiently
 */
const FIELD_CHAIN = /\s(?:[a-zA-Z_][.A-Za-z_0-9]*)?$/;

/**
 * Regex for the starting line of a query or explore
 */
const TOP_LEVEL_SYMBOLS = /\s*((?:source|query|run|sql)\s*:|import)\s*/i;

/**
 * Regex for the beginning of a line comment that can be ignored when fetching the model
 *
 * Could refactor `parseDocumentText` treat the line as empty instead and eliminate cursor
 * adjustment
 */
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
  // Treat the cursor as the end of line to use the regex end-of-line $ anchor
  lines[cursor.line] = lines[cursor.line].slice(0, cursor.character);
  const fieldChainMatch = FIELD_CHAIN.exec(lines[cursor.line]);
  const fieldChain: string | null = fieldChainMatch
    ? // avoid using capture group for performance, fieldChainMatch[0] will always include a leading space
      fieldChainMatch[0].trim()
    : null;
  let i = cursor.line;
  let keyword: string | null = null;

  if (fieldChain === null) {
    return {keyword, fieldChain};
  }

  // Find the nearest keyword followed by a colon in front of the cursor by looking backwards from the cursor
  while (i >= 0) {
    const currentLine = lines[i];
    // A regex for the nearest keywords followed by a colon found within a query body
    const queryKeywords = new RegExp(
      `\\b(?:${QUERY_KEYWORDS.join('|')}):`,
      'gi'
    );
    const matches = currentLine.match(queryKeywords);
    if (matches) {
      // The right-most keyword is always the closest
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
  // Discard the last identifier in the fieldChain
  fieldTree.pop();
  let currentExplore = explore;
  for (const fieldName of fieldTree) {
    if (fieldName.length === 0) {
      return [];
    }
    // Check if a valid chain of explore fields are the prefix for the last field
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
  let completions: string[] = [];
  const fieldTree = fieldChain.split('.');
  // Only consider last identifier in the fieldChain for filtering
  const eligibleFieldsPrefix = fieldTree[fieldTree.length - 1];
  const {dimensions, measures, explores} = bucketMatchingFieldNames(
    fields,
    eligibleFieldsPrefix
  );
  if (DIMENSION_KEYWORDS.includes(keyword)) {
    completions = [...completions, ...dimensions];
  }
  if (MEASURE_KEYWORDS.includes(keyword)) {
    completions = [...completions, ...measures];
  }
  if (EXPLORE_KEYWORDS.includes(keyword)) {
    completions = [...completions, ...explores];
  }
  return completions;
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
   * with most line comments removed
   *  - includes all unextended sources that are not imported
   *  - includes all unextended sources defined in the active document
   */
  truncatedText: string;
  /**
   * Number of top-level import statements and source definitions
   */
  exploreCount: number;
  /**
   * Document text without most line comments for only the top-level definition that the cursor
   * currently resides in or nearest to, undefined if cursor is definitely not within a top-level
   * definition
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
  // Safe to set to -1 as we only ever access this if it has been updated in a previous loop
  let lastNonemptyLine = -1;
  // Set to true only when the line is an import statement or part of a source definition
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
    // Populate optional parse fields with current top-level definition
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

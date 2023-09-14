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
  CompletionParams,
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
} from 'vscode-languageserver/node';
import {Position, TextDocument} from 'vscode-languageserver-textdocument';
import {COMPLETION_DOCS} from '../../common/completion_docs';
import {parseWithCache} from '../parse_cache';
import {TranslateCache} from '../translate_cache';
import {Explore, Field, Model} from '@malloydata/malloy';
import {isFieldAggregate} from '../../extension/common/schema';
import {fieldType} from '../../extension/common/schema';

export async function getCompletionItems(
  document: TextDocument,
  context: CompletionParams,
  translateCache: TranslateCache
): Promise<CompletionItem[]> {
  const schemaCompletions = await getSchemaCompletions(
    document,
    context,
    translateCache
  );
  if (schemaCompletions) {
    return schemaCompletions.map(completion => {
      return {
        kind: CompletionItemKind.Field,
        label: completion,
      };
    });
  }
  const completions = parseWithCache(document).completions(context.position);
  const cleanedCompletions: CompletionItem[] = completions.map(completion => {
    return {
      kind: CompletionItemKind.Property,
      label: completion.text,
      data: {
        type: completion.type,
        property: completion.text.substring(0, completion.text.length - 2),
      },
    };
  });
  return cleanedCompletions;
}

async function getSchemaCompletions(
  document: TextDocument,
  context: CompletionParams,
  translateCache: TranslateCache
): Promise<string[]> {
  const parse = parseDocumentText(document.getText(), context.position);
  if (parse.nearestDefinitionText && parse.adjustedCursor) {
    const exploreName = getQueriedExploreName(parse.nearestDefinitionText);
    const {keyword, chain} = getQueryContext(
      parse.nearestDefinitionText,
      parse.adjustedCursor
    );
    if (exploreName !== null && keyword != null && chain !== null) {
      let model: Model | undefined = undefined;
      try {
        model = await translateCache.translateWithTruncatedCache(
          document,
          parse.truncatedText,
          parse.exploreCount,
          exploreName
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
          const fields = getFieldsFromChain(
            chain,
            exploreMap[exploreName],
            exploreMap
          );
          return filterCompletions(fields, keyword, chain);
        }
      }
    }
  }
  return [];
}

function getQueriedExploreName(text: string[]): string | null {
  const unnamedQuery =
    /\b(run|query)\s*:\s*([A-Za-z_][A-Za-z_0-9]*)\s*->\s*{/gi;
  const unnamedQueryMatch = unnamedQuery.exec(text[0]);
  if (unnamedQueryMatch) {
    return unnamedQueryMatch[2];
  }
  const namedQuery =
    /\bquery\s*:\s*([A-Za-z_][A-Za-z_0-9]*)\s+is\s+([A-Za-z_][A-Za-z_0-9]*)\s+->\s*{/gi;
  const namedQueryMatch = namedQuery.exec(text[0]);
  return namedQueryMatch ? namedQueryMatch[2] : null;
}

function getQueryContext(lines: string[], cursor: Position) {
  lines[cursor.line] = lines[cursor.line].slice(0, cursor.character);
  const chainRegex =
    /\s+(([a-zA-z_][A-Za-z_0-9]*)(\.([a-zA-z_][A-Za-z_0-9]*)*)*)?$/g;
  const chainMatch = chainRegex.exec(lines[cursor.line]);
  const chain: string | null = chainMatch ? chainMatch[0].trim() : null;
  const simpleKeywords =
    /\b(aggregate|calculate|group_by|having|index|limit|nest|order_by|project|sample|top|where|timezone):/gi;
  let i = cursor.line;
  let keyword: string | null = null;

  while (i >= 0) {
    const currentLine = lines[i];
    const matches = currentLine.match(simpleKeywords);
    if (matches) {
      keyword = matches[matches.length - 1]
        .slice(0, matches[matches.length - 1].length - 1)
        .toLowerCase();
      break;
    }
    i--;
  }
  return {keyword, chain};
}

function getFieldsFromChain(
  chain: string,
  explore: Explore,
  exploreMap: Record<string, Explore>
): Field[] {
  const fieldTree = chain.split('.');
  fieldTree.pop();
  let currentExplore = explore;
  for (const fieldName of fieldTree) {
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

function filterCompletions(fields: Field[], keyword: string, chain: string) {
  const fieldTree = chain.split('.');
  const fieldToMatch = fieldTree[fieldTree.length - 1];
  const {queries, dimensions, measures, explores} = bucketMatchingFieldNames(
    fields,
    fieldToMatch
  );
  if (keyword === 'group_by') {
    return [...dimensions, ...explores];
  }
  // else if (keyword in ['aggregate', 'having'])
  //   return [...measures, ...explores];
  // else if (keyword in ['order_by'])
  //   return [...dimensions, ...measures, ...explores];
  else {
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

function parseDocumentText(text: string, cursor: Position): DocumentTextParse {
  const parse: DocumentTextParse = {
    truncatedText: '',
    exploreCount: 0,
  };
  const truncatedLines: string[] = [];
  const topLevelSymbols = /\b((?:source|query|run|sql)\s*:|import)\s*/gi;

  let lastSymbolStart: Position | undefined = undefined;
  let lastNonemptyLine = -1;
  let includeLines = false;

  const lines = text.split('\n');
  for (const [i, line] of lines.entries()) {
    const symbolMatches = topLevelSymbols.exec(line);
    if (symbolMatches != null && symbolMatches.index === 0) {
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
  const comments = /\s*(--|\/\/)/g;
  const commentMatches = comments.exec(line);
  return (commentMatches && commentMatches.index === 0) || line.length === 0;
}

export function resolveCompletionItem(item: CompletionItem): CompletionItem {
  if (item.data) {
    item.detail = item.data.property;
    const docs = (COMPLETION_DOCS[item.data.type] || {})[item.data.property];
    if (docs) {
      item.documentation = {
        kind: MarkupKind.Markdown,
        value: docs,
      };
    }
  }
  return item;
}

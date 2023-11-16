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

import {TextDocument} from 'vscode-languageserver-textdocument';
import {HighlightType} from '@malloydata/malloy';
import {SemanticTokens, SemanticTokensBuilder} from 'vscode-languageserver';
import {parseWithCache} from '../parse_cache';

export const TOKEN_TYPES = [
  'class',
  'interface',
  'enum',
  'function',
  'variable',
  'keyword',
  'number',
  'string',
  'comment',
  'type',
  'regexp',
  'macro',
  'property.readonly',
  'label',
  'enumMember',
  'operator',
];

export const TOKEN_MODIFIERS = ['declaration', 'documentation'];

export function stubMalloyHighlights(_document: TextDocument): SemanticTokens {
  return new SemanticTokensBuilder().build();
}

// TODO Currently semantic highlights are disabled. Either remove `getMalloyHighlights`
//      or call it instead of `stubMalloyHighlights`.
export function getMalloyHighlights(document: TextDocument): SemanticTokens {
  const tokensBuilder = new SemanticTokensBuilder();

  const text = document.getText();
  const textLines = text.split('\n');
  const parse = parseWithCache(document);

  parse.highlights.forEach(highlight => {
    for (
      let line = highlight.range.start.line;
      line <= highlight.range.end.line;
      line++
    ) {
      const lineText = textLines[line];
      let length;
      let start;
      if (highlight.range.start.line === highlight.range.end.line) {
        length =
          highlight.range.end.character - highlight.range.start.character;
        start = highlight.range.start.character;
      } else if (line === highlight.range.start.line) {
        length = lineText.length - highlight.range.start.character;
        start = highlight.range.start.character;
      } else if (line === highlight.range.end.line) {
        length = highlight.range.end.character;
        start = 0;
      } else {
        length = lineText.length;
        start = 0;
      }
      tokensBuilder.push(
        line,
        start,
        length,
        TOKEN_TYPES.indexOf(mapTypes(highlight.type)),
        0
      );
    }
  });

  return tokensBuilder.build();
}

function mapTypes(type: string) {
  switch (type) {
    case HighlightType.Identifier:
      return 'variable';
    case HighlightType.Call.Aggregate:
    case HighlightType.Keyword.AggregateModifier.Distinct:
      return 'function';
    case HighlightType.Type:
      return 'type';
    case HighlightType.Keyword.Is:
    case HighlightType.Keyword.With:
    case HighlightType.Keyword.On:
    case HighlightType.Keyword.Desc:
    case HighlightType.Keyword.Asc:
    case HighlightType.Call.Cast:
    case HighlightType.Keyword.CastModifier.As:
    case HighlightType.Keyword.Pick:
    case HighlightType.Keyword.When:
    case HighlightType.Keyword.Else:
    case HighlightType.Keyword.Import:
      return 'keyword';
    // These are more like meta types, so maybe they should be highlighted differently
    case HighlightType.Keyword.JSON:
    case HighlightType.Keyword.Turtle:
      return 'keyword';
    case HighlightType.Call.TimeFrame:
      return 'variable';
    case HighlightType.Literal.String:
      return 'string';
    case HighlightType.Literal.Boolean:
      return 'enumMember';
    case HighlightType.Literal.Null:
      return 'keyword';
    case HighlightType.Literal.Number:
      return 'number';
    case HighlightType.Literal.RegularExpression:
      return 'regexp';
    case HighlightType.Literal.Date:
      return 'number';
    case HighlightType.Operator.Comparison:
      return 'operator';
    case HighlightType.Operator.Boolean:
      return 'keyword';
    case HighlightType.Operator.Date:
      return 'keyword';
    case HighlightType.Comment.Line:
    case HighlightType.Comment.Block:
      return 'comment';
    case HighlightType.Property.Accept:
    case HighlightType.Property.Aggregate:
    case HighlightType.Property.Dimension:
    case HighlightType.Property.Except:
    case HighlightType.Property.Source:
    case HighlightType.Property.GroupBy:
    case HighlightType.Property.Having:
    case HighlightType.Property.Index:
    case HighlightType.Property.JoinOne:
    case HighlightType.Property.JoinMany:
    case HighlightType.Property.JoinCross:
    case HighlightType.Property.Limit:
    case HighlightType.Property.Measure:
    case HighlightType.Property.Nest:
    case HighlightType.Property.OrderBy:
    case HighlightType.Property.PrimaryKey:
    case HighlightType.Property.Project:
    case HighlightType.Property.Query:
    case HighlightType.Property.Rename:
    case HighlightType.Property.Top:
    case HighlightType.Property.Where:
    case HighlightType.Property.SQL:
      return 'keyword';
    case HighlightType.Call.Table:
    case HighlightType.Call.From:
    case HighlightType.Call.FromSQL:
    case HighlightType.Call.Function:
      return 'function';
    default:
      throw new Error(`Unexpected type ${type}`);
  }
}

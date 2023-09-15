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
import {TextDocument} from 'vscode-languageserver-textdocument';
import {COMPLETION_DOCS} from '../../common/completion_docs';
import {parseWithCache} from '../parse_cache';
import {TranslateCache} from '../translate_cache';
import {getSchemaCompletions} from './schema_completions';

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

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
  Hover,
  HoverParams,
  MarkupContent,
  MarkupKind,
  TextDocuments,
} from 'vscode-languageserver';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {DocumentLocation, Model, Tag} from '@malloydata/malloy';

import {COMPLETION_DOCS} from '../../common/completion_docs';
import {parseWithCache} from '../parse_cache';
import {TranslateCache} from '../translate_cache';

// TODO: export from Malloy
type ImportLocation = Exclude<ReturnType<Model['getImport']>, undefined>;
type DocumentReference = Exclude<ReturnType<Model['getReference']>, undefined>;

export const getHover = async (
  document: TextDocument,
  documents: TextDocuments<TextDocument>,
  translateCache: TranslateCache,
  {position}: HoverParams
): Promise<Hover | null> => {
  const context = parseWithCache(document).helpContext(position);

  if (context?.token) {
    const name = context.token.replace(/:$/, '');

    if (name) {
      const value = COMPLETION_DOCS[context.type][name];
      if (value) {
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value,
          },
        };
      } else if (context.type === 'model_property') {
        const model = await translateCache.translateWithCache(
          document.uri,
          document.languageId
        );
        const importLocation = model?.getImport(position);
        if (importLocation) {
          return getImportHover(translateCache, documents, importLocation);
        }

        return null;
      } else {
        const model = await translateCache.translateWithCache(
          document.uri,
          document.languageId
        );
        const reference = model?.getReference(position);
        if (reference) {
          return getReferenceHover(translateCache, documents, reference);
        }
      }
    }
  }

  return null;
};

async function getImportHover(
  translateCache: TranslateCache,
  documents: TextDocuments<TextDocument>,
  importLocation: ImportLocation
): Promise<Hover | null> {
  const importedDocument = documents.get(importLocation.importURL) ?? {
    uri: importLocation.importURL,
    version: 0,
    languageId: 'malloy',
  };
  const importedModel = await translateCache.translateWithCache(
    importedDocument.uri,
    importedDocument.version,
    importedDocument.languageId
  );
  if (importedModel) {
    const sources = bulletedList('Sources', importedModel.exportedExplores);
    const queries = bulletedList('Queries', importedModel.namedQueries);
    const markdown = `${sources}\n${queries}`;
    const contents: MarkupContent = {
      kind: MarkupKind.Markdown,
      value: markdown,
    };
    return {
      contents,
    };
  }
  return null;
}

function bulletedList(
  heading: string,
  elements: {name: string; location?: DocumentLocation}[]
): string {
  if (elements.length) {
    return (
      `* ${heading}\n` +
      elements
        .map(query => {
          const name = query.name;
          const uri = query.location
            ? `${query.location.url}#${query.location.range.start.line + 1}`
            : '';
          return `  * [${name}](${uri})`;
        })
        .join('\n')
    );
  }
  return '';
}

function getReferenceHover(
  _translateCache: TranslateCache,
  _documents: TextDocuments<TextDocument>,
  {text, definition}: DocumentReference
) {
  const tags = Tag.annotationToTaglines(definition.annotation).join('');
  const markdown = `\`\`\`
${tags}${text}: ${definition.type}
\`\`\``;
  const contents: MarkupContent = {
    kind: MarkupKind.Markdown,
    value: markdown,
  };
  return {
    contents,
  };
}

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

import {Location, Position, DefinitionLink} from 'vscode-languageserver/node';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {TranslateCache} from '../translate_cache';

const fixNotebookUri = (uriString: string, baseUriString: string) => {
  const uri = new URL(uriString);
  const baseUri = new URL(baseUriString);

  if (uri.protocol === 'vscode-notebook-cell:' && !uri.hash) {
    uriString = uriString.replace('vscode-notebook-cell:', baseUri.protocol);
  }

  return uriString;
};

export async function getMalloyDefinitionReference(
  translateCache: TranslateCache,
  document: TextDocument,
  position: Position
): Promise<Location[] | DefinitionLink[]> {
  try {
    const {model, baseUri} = await translateCache.translateWithCache(
      document.uri,
      document.version,
      document.languageId
    );
    if (!model) {
      return [];
    }
    const reference = model.getReference(position);
    const location = reference?.definition.location;
    if (location) {
      return [
        {
          uri: fixNotebookUri(location.url, baseUri),
          range: location.range,
        },
      ];
    } else {
      const importLocation = model.getImport(position);
      if (importLocation) {
        const documentStart = {
          start: {line: 0, character: 0},
          end: {line: 0, character: 0},
        };
        return [
          {
            originSelectionRange: importLocation.location.range,
            targetUri: fixNotebookUri(importLocation.importURL, baseUri),
            targetRange: documentStart,
            targetSelectionRange: documentStart,
          },
        ];
      }
    }
    return [];
  } catch (error) {
    // TODO It's probably possible to get some references from a model that has errors;
    //      maybe the Model api should not throw an error if there are errors, but just
    //      make them available via `.errors` or something.
    return [];
  }
}

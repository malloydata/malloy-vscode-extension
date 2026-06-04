/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Location, Position, DefinitionLink} from 'vscode-languageserver';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {TranslateCache} from '../translate_cache';

export async function getMalloyDefinitionReference(
  translateCache: TranslateCache,
  document: TextDocument,
  position: Position
): Promise<Location[] | DefinitionLink[]> {
  try {
    const model = await translateCache.translateWithCache(
      document.uri,
      document.languageId
    );
    if (!model) {
      return [];
    }
    const reference = model.referenceAt(position);
    const location = reference?.definitionLocation;
    if (location) {
      return [
        {
          uri: location.url,
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
            targetUri: importLocation.importURL,
            targetRange: documentStart,
            targetSelectionRange: documentStart,
          },
        ];
      }
    }
    return [];
  } catch {
    // TODO It's probably possible to get some references from a model that has errors;
    //      maybe the Model api should not throw an error if there are errors, but just
    //      make them available via `.errors` or something.
    return [];
  }
}

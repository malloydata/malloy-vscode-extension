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

import { TextDocuments, Location, Position } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ConnectionManager } from "../../common/connection_manager";
import { TranslateCache } from "../types";

export async function getMalloyDefinitionReference(
  translateCache: TranslateCache,
  connectionManager: ConnectionManager,
  documents: TextDocuments<TextDocument>,
  document: TextDocument,
  position: Position
): Promise<Location[]> {
  try {
    const model = await translateCache.translateWithCache(
      connectionManager,
      document,
      documents
    );
    const reference = model.getReference(position);
    const location = reference?.definition.location;
    if (location) {
      return [
        {
          uri: location.url,
          range: location.range,
        },
      ];
    }
    return [];
  } catch {
    // TODO It's probably possible to get some references from a model that has errors;
    //      maybe the Model api should not throw an error if there are errors, but just
    //      make them available via `.errors` or something.
    return [];
  }
}

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
/* eslint-disable no-console */

import {
  TextDocuments,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  SemanticTokensBuilder,
  CompletionItem,
  HoverParams,
  Hover,
  Connection,
} from 'vscode-languageserver';
import debounce from 'lodash/debounce';

import {TextDocument} from 'vscode-languageserver-textdocument';
import {getMalloyDiagnostics} from './diagnostics';
import {getMalloySymbols} from './symbols';
import {TOKEN_TYPES, TOKEN_MODIFIERS, stubMalloyHighlights} from './highlights';
import {getMalloyLenses} from './lenses';
import {
  getCompletionItems,
  resolveCompletionItem,
} from './completions/completions';
import {getHover} from './hover/hover';
import {getMalloyDefinitionReference} from './definitions/definitions';
import {TranslateCache} from './translate_cache';
import {ConnectionManager} from '../common/connection_manager';

export const initServer = (
  documents: TextDocuments<TextDocument>,
  connection: Connection,
  connectionManager: ConnectionManager
) => {
  let haveConnectionsBeenSet = false;
  connection.onInitialize((params: InitializeParams) => {
    console.info('Server onInitialize');
    const capabilities = params.capabilities;

    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        documentSymbolProvider: true,
        codeLensProvider: {
          resolveProvider: false,
        },
        completionProvider: {
          resolveProvider: true,
        },
        definitionProvider: true,
        semanticTokensProvider: {
          full: true,
          range: false,
          legend: {
            tokenTypes: TOKEN_TYPES,
            tokenModifiers: TOKEN_MODIFIERS,
          },
        },
        hoverProvider: true,
      },
    };

    if (capabilities.workspace?.workspaceFolders) {
      result.capabilities.workspace = {
        workspaceFolders: {
          supported: true,
        },
      };
    }

    return result;
  });

  const translateCache = new TranslateCache(connection);

  async function diagnoseDocument(document: TextDocument) {
    if (haveConnectionsBeenSet) {
      // Necessary to copy the versions, because they're mutated in the same document object
      const versionsAtRequestTime = new Map(
        documents.all().map(document => [document.uri, document.version])
      );
      const diagnostics = await getMalloyDiagnostics(
        translateCache,
        connectionManager,
        documents,
        document
      );
      // Only send diagnostics if the document hasn't changed since this request started
      for (const uri in diagnostics) {
        const versionAtRequest = versionsAtRequestTime.get(uri);
        if (
          versionAtRequest === undefined ||
          versionAtRequest === document.version
        ) {
          connection.sendDiagnostics({
            uri,
            diagnostics: diagnostics[uri],
            version: documents.get(uri)?.version,
          });
        }
      }
    }
  }

  const debouncedDiagnoseDocument = debounce(diagnoseDocument, 300);

  documents.onDidChangeContent(change => {
    console.info('Server onDidChangeContent');
    debouncedDiagnoseDocument(change.document);
  });

  connection.onDocumentSymbol(handler => {
    console.info('Server onDocumentSymbol');
    const document = documents.get(handler.textDocument.uri);
    return document ? getMalloySymbols(document) : [];
  });

  connection.languages.semanticTokens.on(handler => {
    const document = documents.get(handler.textDocument.uri);
    return document
      ? stubMalloyHighlights(document)
      : new SemanticTokensBuilder().build();
  });

  connection.onCodeLens(handler => {
    console.info('Server onCodeLens');
    const document = documents.get(handler.textDocument.uri);
    return document ? getMalloyLenses(document) : [];
  });

  connection.onDefinition(handler => {
    console.info('Server onDefinition');
    const document = documents.get(handler.textDocument.uri);
    return document
      ? getMalloyDefinitionReference(
          translateCache,
          connectionManager,
          documents,
          document,
          handler.position
        )
      : [];
  });

  connection.onDidChangeConfiguration(change => {
    console.info('Server onDidChangeConfiguration');
    connectionManager.setConnectionsConfig(change.settings.malloy.connections);
    haveConnectionsBeenSet = true;
    documents.all().forEach(diagnoseDocument);
  });

  // This handler provides the initial list of the completion items.
  connection.onCompletion((params): CompletionItem[] => {
    console.info('Server onCompletion');
    const document = documents.get(params.textDocument.uri);
    return document ? getCompletionItems(document, params) : [];
  });

  // This handler resolves additional information for the item selected in
  // the completion list.
  connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    console.info('Server onCompletionResolve');
    return resolveCompletionItem(item);
  });

  connection.onHover((params: HoverParams): Hover | null => {
    console.info('Server onHover');
    const document = documents.get(params.textDocument.uri);

    return document ? getHover(document, params) : null;
  });

  documents.listen(connection);

  connection.listen();
};

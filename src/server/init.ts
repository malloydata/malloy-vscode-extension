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
  TextDocuments,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  CompletionItem,
  HoverParams,
  Hover,
  Connection,
  Position,
  DidChangeConfigurationParams,
} from 'vscode-languageserver';
import debounce from 'lodash/debounce';

import {TextDocument} from 'vscode-languageserver-textdocument';
import {getMalloyDiagnostics} from './diagnostics';
import {getMalloySymbols} from './symbols';
import {getMalloyLenses} from './lenses';
import {
  getCompletionItems,
  resolveCompletionItem,
} from './completions/completions';
import {getHover} from './hover/hover';
import {getMalloyDefinitionReference} from './definitions/definitions';
import {TranslateCache} from './translate_cache';
import {ConnectionManager} from '../common/connection_manager';
import {findMalloyLensesAt} from './lenses/lenses';
import {prettyLogUri} from '../common/log';
import {getMalloyCodeAction} from './code_actions/code_actions';

export const initServer = (
  connection: Connection,
  connectionManager: ConnectionManager,
  onDidChangeConfiguration?: (params: DidChangeConfigurationParams) => void
) => {
  const documents = new TextDocuments(TextDocument);
  let haveConnectionsBeenSet = false;
  connection.onInitialize((params: InitializeParams) => {
    connection.console.info('onInitialize');
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
        codeActionProvider: {
          resolveProvider: false,
        },
        definitionProvider: true,
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

  const translateCache = new TranslateCache(
    documents,
    connection,
    connectionManager
  );

  async function diagnoseDocument(document: TextDocument) {
    const prettyUri = prettyLogUri(document.uri);

    if (haveConnectionsBeenSet) {
      connection.console.info(`diagnoseDocument ${prettyUri} start`);
      // Necessary to copy the versions, because they're mutated in the same document object
      const versionsAtRequestTime = new Map(
        documents.all().map(document => [document.uri, document.version])
      );
      const diagnostics = await getMalloyDiagnostics(translateCache, document);

      // Only send diagnostics if the document hasn't changed since this request started
      for (const uri in diagnostics) {
        const versionAtRequest = versionsAtRequestTime.get(uri);
        if (
          versionAtRequest === undefined ||
          versionAtRequest === document.version
        ) {
          await connection.sendDiagnostics({
            uri,
            diagnostics: diagnostics[uri],
            version: documents.get(uri)?.version,
          });
        }
      }

      // Trigger diagnostics for all documents we know that import this one,
      // too.
      for (const dependency of translateCache.dependentsOf(document.uri)) {
        const document = documents.get(dependency);
        if (document) {
          connection.console.info(`diagnoseDocument recompiling ${prettyLogUri(document.uri)}`);
          debouncedDiagnoseDocument(document);
        }
      }
      connection.console.info(`diagnoseDocument ${prettyUri} end`);
    }
  }

  const debouncedDiagnoseDocuments: Record<
    string,
    (document: TextDocument) => Promise<void> | undefined
  > = {};

  const debouncedDiagnoseDocument = (document: TextDocument) => {
    const {uri} = document;
    if (!debouncedDiagnoseDocuments[uri]) {
      debouncedDiagnoseDocuments[uri] = debounce(diagnoseDocument, 300);
    }
    debouncedDiagnoseDocuments[uri](document)?.catch(console.error);
  };

  documents.onDidChangeContent(change => {
    debouncedDiagnoseDocument(change.document);
  });

  documents.onDidClose(event => {
    const {uri} = event.document;
    // translateCache.cache.delete(uri);
    // TODO delete files from cache..
    delete debouncedDiagnoseDocuments[uri];
  });

  connection.onDocumentSymbol(handler => {
    const document = documents.get(handler.textDocument.uri);
    return document && document.languageId === 'malloy'
      ? getMalloySymbols(document)
      : [];
  });

  connection.onCodeLens(async handler => {
    const document = documents.get(handler.textDocument.uri);
    if (document && document.languageId === 'malloy') {
      return await getMalloyLenses(connection, document, connectionManager);
    }
    return [];
  });

  connection.onCodeAction(async handler => {
    const document = documents.get(handler.textDocument.uri);
    if (document) {
      return getMalloyCodeAction(translateCache, document, handler.range);
    }
    return null;
  });

  connection.onRequest(
    'malloy/findLensesAt',
    async ({uri, position}: {uri: string; position: Position}) => {
      const document = documents.get(uri);
      if (document && position) {
        return await findMalloyLensesAt(
          connection,
          document,
          position,
          connectionManager
        );
      } else {
        return [];
      }
    }
  );

  connection.onDefinition(handler => {
    const document = documents.get(handler.textDocument.uri);
    return document && document.languageId === 'malloy'
      ? getMalloyDefinitionReference(translateCache, document, handler.position)
      : [];
  });

  connection.onDidChangeConfiguration(change => {
    onDidChangeConfiguration?.(change);
    connectionManager.setConnectionsConfig(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (change?.settings as any)?.malloy?.connections ?? []
    );
    haveConnectionsBeenSet = true;
    // translateCache.cache.clear();
    // TODO clear cache...
    documents.all().forEach(debouncedDiagnoseDocument);
  });

  // This handler provides the initial list of the completion items.
  connection.onCompletion(async (params): Promise<CompletionItem[]> => {
    const document = documents.get(params.textDocument.uri);
    if (document && document.languageId === 'malloy') {
      const completionItems = await getCompletionItems(
        document,
        params,
        translateCache
      );
      return completionItems;
    } else {
      return [];
    }
  });

  // This handler resolves additional information for the item selected in
  // the completion list.
  connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return resolveCompletionItem(item);
  });

  connection.onHover(async (params: HoverParams): Promise<Hover | null> => {
    const document = documents.get(params.textDocument.uri);

    return document && document.languageId === 'malloy'
      ? getHover(document, documents, translateCache, params)
      : null;
  });

  documents.listen(connection);

  connection.listen();

  connection.console.info('Server loaded');
};

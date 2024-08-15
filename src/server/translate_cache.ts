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

import {Connection, TextDocuments} from 'vscode-languageserver';
import {
  MalloyError,
  Model,
  ModelMaterializer,
  Runtime,
} from '@malloydata/malloy';
import {TextDocument} from 'vscode-languageserver-textdocument';

import {ConnectionManager} from '../common/connection_manager';
import {BuildModelRequest, CellData} from '../common/types/file_handler';
import {MalloySQLSQLParser} from '@malloydata/malloy-sql';
import {FetchModelMessage} from '../common/types/message_types';
import {fixLogRange} from '../common/malloy_sql';
import {prettyLogUri} from '../common/log';

export class TranslateCache {
  // Cache for truncated documents used for providing schema suggestions
  truncatedCache = new Map<
    string,
    {model: Model; exploreCount: number; version: number}
  >();
  truncatedVersion = 0;
  cache = new Map<string, {model: Model; version: number}>();

  constructor(
    private documents: TextDocuments<TextDocument>,
    private connection: Connection,
    private connectionManager: ConnectionManager
  ) {
    connection.onRequest(
      'malloy/fetchModel',
      async (event: BuildModelRequest): Promise<FetchModelMessage> => {
        const model = await this.translateWithCache(
          event.uri,
          event.version,
          event.languageId,
          event.refreshSchemaCache
        );
        if (model) {
          return {
            explores: model.explores.map(explore => explore.toJSON()) || [],
            queries: model.namedQueries,
          };
        } else {
          return {
            explores: [],
            queries: [],
          };
        }
      }
    );
  }

  async getDocumentText(
    documents: TextDocuments<TextDocument>,
    uri: URL
  ): Promise<string> {
    const cached = documents.get(uri.toString());
    if (cached) {
      return cached.getText();
    } else {
      this.connection.console.info('fetchFile requesting ' + uri.toString());
      return await this.connection.sendRequest('malloy/fetchFile', {
        uri: uri.toString(),
      });
    }
  }

  async createModelMaterializer(
    uri: string,
    runtime: Runtime,
    refreshSchemaCache?: boolean | number
  ): Promise<ModelMaterializer | null> {
    const prettyUri = prettyLogUri(uri);
    this.connection.console.info(`createModelMaterializer ${prettyUri} start`);
    let modelMaterializer: ModelMaterializer | null = null;
    const queryFileURL = new URL(uri);
    if (queryFileURL.protocol === 'vscode-notebook-cell:') {
      if (refreshSchemaCache && typeof refreshSchemaCache !== 'number') {
        refreshSchemaCache = Date.now();
      }
      const cellData = await this.getCellData(new URL(uri));
      const importBaseURL = new URL(cellData.baseUri);
      for (const cell of cellData.cells) {
        if (cell.languageId === 'malloy') {
          const url = new URL(cell.uri);
          if (modelMaterializer) {
            modelMaterializer = modelMaterializer.extendModel(url, {
              importBaseURL,
              refreshSchemaCache,
              noThrowOnError: true,
            });
          } else {
            modelMaterializer = runtime.loadModel(url, {
              importBaseURL,
              refreshSchemaCache,
              noThrowOnError: true,
            });
          }
        }
      }
    } else {
      let importBaseURL: URL | undefined;
      if (queryFileURL.protocol === 'untitled:') {
        const workspaceFolders =
          await this.connection.workspace.getWorkspaceFolders();
        if (workspaceFolders?.[0]) {
          importBaseURL = new URL(workspaceFolders[0].uri + '/');
        }
      }
      modelMaterializer = runtime.loadModel(queryFileURL, {
        importBaseURL,
        refreshSchemaCache,
        noThrowOnError: true,
      });
    }
    this.connection.console.info(`createModelMaterializer ${prettyUri} end`);
    return modelMaterializer;
  }

  async getCellData(uri: URL): Promise<CellData> {
    return await this.connection.sendRequest('malloy/fetchCellData', {
      uri: uri.toString(),
    });
  }

  async translateWithTruncatedCache(
    document: TextDocument,
    text: string,
    exploreCount: number
  ): Promise<Model | undefined> {
    this.connection.console.info(
      `translateWithTruncatedCache ${document.uri} start`
    );
    const {uri, languageId} = document;
    if (languageId === 'malloy') {
      const entry = this.truncatedCache.get(uri);
      // Only re-compile the model if the number of explores has changed
      if (entry && entry.exploreCount === exploreCount) {
        this.connection.console.info(
          `translateWithTruncatedCache ${document.uri} hit`
        );
        return entry.model;
      }
      const files = {
        readURL: (url: URL) => {
          if (url.toString() === uri) {
            return Promise.resolve(text);
          } else {
            return this.getDocumentText(this.documents, url);
          }
        },
      };
      // TODO: Possibly look into having remaining statements run "in the background" and having
      // new runs preempt the current fetch
      const runtime = new Runtime(
        files,
        this.connectionManager.getConnectionLookup(new URL(uri))
      );
      const modelMaterializer = await this.createModelMaterializer(
        uri,
        runtime,
        false
      );
      const model = await modelMaterializer?.getModel();
      if (model) {
        this.truncatedCache.set(uri, {
          model,
          exploreCount,
          version: this.truncatedVersion++,
        });
      }
      this.connection.console.info(
        `translateWithTruncatedCache ${document.uri} miss`
      );
      return model;
    }
    return undefined;
  }

  async translateWithCache(
    uri: string,
    currentVersion: number,
    languageId: string,
    refreshSchemaCache?: boolean
  ): Promise<Model | undefined> {
    const prettyUri = prettyLogUri(uri);
    const entry = this.cache.get(uri);
    if (entry && entry.version === currentVersion && !refreshSchemaCache) {
      const {model} = entry;
      this.connection.console.info(
        `translateWithCache ${prettyUri} v${currentVersion} hit`
      );
      return model;
    }
    this.connection.console.info(
      `translateWithCache ${prettyUri} v${currentVersion} miss`
    );

    const text = await this.getDocumentText(this.documents, new URL(uri));
    if (languageId === 'malloy-sql') {
      const parse = MalloySQLSQLParser.parse(text, uri);
      const files = {
        readURL: (url: URL) => this.getDocumentText(this.documents, url),
      };
      const runtime = new Runtime(
        files,
        this.connectionManager.getConnectionLookup(new URL(uri))
      );

      const modelMaterializer = await this.createModelMaterializer(
        uri,
        runtime,
        refreshSchemaCache
      );

      for (const malloyQuery of parse.embeddedMalloyQueries) {
        if (!modelMaterializer) {
          throw new Error('Missing model definition');
        }
        try {
          await modelMaterializer.getQuery(`run:\n${malloyQuery.query}`);
        } catch (e) {
          // some errors come from Runtime stuff
          if (e instanceof MalloyError) {
            e.problems.forEach(log => {
              // "run:\n" adds a line, so we subtract the line here
              fixLogRange(uri, malloyQuery, log, -1);
            });
          }

          throw e;
        }
      }

      const model = await modelMaterializer?.getModel();
      if (model) {
        this.cache.set(uri, {version: currentVersion, model});
      }
      this.connection.console.info(
        `translateWithCache ${prettyUri} v${currentVersion} set`
      );
      return model;
    } else {
      const files = {
        readURL: (url: URL) => this.getDocumentText(this.documents, url),
      };
      const runtime = new Runtime(
        files,
        this.connectionManager.getConnectionLookup(new URL(uri))
      );

      const modelMaterializer = await this.createModelMaterializer(
        uri,
        runtime,
        refreshSchemaCache
      );
      const model = await modelMaterializer?.getModel();
      if (model) {
        this.cache.set(uri, {version: currentVersion, model});
        this.connection.console.info(
          `translateWithCache ${prettyUri} v${currentVersion} set`
        );
      }
      return model;
    }
  }
}

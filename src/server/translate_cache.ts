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
  Connection,
  LogMessageNotification,
  TextDocuments,
} from 'vscode-languageserver';
import {
  MalloyError,
  Model,
  ModelMaterializer,
  NamedModelObject,
  NamedQuery,
  Runtime,
} from '@malloydata/malloy';
import {TextDocument} from 'vscode-languageserver-textdocument';

import {ConnectionManager} from '../common/connection_manager';
import {BuildModelRequest, CellData} from '../common/types';
import {
  MalloySQLParser,
  MalloySQLSQLParser,
  MalloySQLSQLStatement,
  MalloySQLStatementType,
} from '@malloydata/malloy-sql';
import {FetchModelMessage} from '../common/message_types';
import {DocumentTextParse} from './completions/completions';
import {fixLogRange} from '../common/malloy_sql';

const isNamedQuery = (object: NamedModelObject): object is NamedQuery =>
  object.type === 'query';

export class TranslateCache implements TranslateCache {
  truncatedCache = new Map<
    string,
    {model: Model; exploreCount: number; version: number}
  >();
  truncatedVersion: number = 0;
  cache = new Map<string, {model: Model; version: number; baseUri: string}>();

  constructor(
    private documents: TextDocuments<TextDocument>,
    private connection: Connection,
    private connectionManager: ConnectionManager
  ) {
    connection.onRequest(
      'malloy/fetchModel',
      async (event: BuildModelRequest): Promise<FetchModelMessage> => {
        const {model} = await this.translateWithCache(
          event.uri,
          event.version,
          event.languageId
        );
        if (model) {
          return {
            explores: model.explores.map(explore => explore.toJSON()) || [],
            // TODO(whscullin) - Create non-backdoor access method
            queries: Object.values(model._modelDef.contents).filter(
              isNamedQuery
            ),
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
      /* eslint-disable-next-line no-console */
      console.info('fetchFile requesting', uri.toString());
      return await this.connection.sendRequest('malloy/fetchFile', {
        uri: uri.toString(),
      });
    }
  }

  async createModelMaterializer(
    uri: string,
    runtime: Runtime
  ): Promise<{modelMaterializer: ModelMaterializer | null; baseUri: string}> {
    let modelMaterializer: ModelMaterializer | null = null;
    let baseUri = uri;
    const queryFileURL = new URL(uri);
    if (queryFileURL.protocol === 'vscode-notebook-cell:') {
      const cellData = await this.getCellData(new URL(uri));
      baseUri = cellData.baseUri;
      for (const cell of cellData.cells) {
        if (cell.languageId === 'malloy') {
          const url = new URL(cell.uri);
          if (modelMaterializer) {
            modelMaterializer = modelMaterializer.extendModel(url);
          } else {
            modelMaterializer = runtime.loadModel(url);
          }
        }
      }
    } else {
      modelMaterializer = runtime.loadModel(queryFileURL);
    }
    return {modelMaterializer, baseUri};
  }

  async getCellData(uri: URL): Promise<CellData> {
    return await this.connection.sendRequest('malloy/fetchCellData', {
      uri: uri.toString(),
    });
  }

  async translateWithTruncatedCache(
    document: TextDocument,
    text: string,
    exploreCount: number,
    queriedSource: string
  ): Promise<Model | undefined> {
    const {uri, languageId} = document;
    if (languageId === 'malloy') {
      const entry = this.truncatedCache.get(uri);
      if (entry && entry.exploreCount === exploreCount) {
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
      // TODO: Look into having remaining statements run "in the background" and having new runs
      //       preempt the current fetch
      const runtime = new Runtime(
        files,
        this.connectionManager.getConnectionLookup(new URL(uri))
      );
      const {modelMaterializer: mm} = await this.createModelMaterializer(
        uri,
        runtime
      );
      const model = await mm?.getModel();
      if (model) {
        this.truncatedCache.set(uri, {
          model,
          exploreCount,
          version: this.truncatedVersion++,
        });
      }
      return model;
    }
    return undefined;
  }

  async translateWithCache(
    uri: string,
    currentVersion: number,
    languageId: string
  ): Promise<{model: Model | undefined; baseUri: string}> {
    const entry = this.cache.get(uri);
    if (entry && entry.version === currentVersion) {
      const {model, baseUri} = entry;
      return {model, baseUri};
    }

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

      const {modelMaterializer, baseUri} = await this.createModelMaterializer(
        uri,
        runtime
      );

      for (const malloyQuery of parse.embeddedMalloyQueries) {
        if (!modelMaterializer) {
          throw new Error('Missing model definition');
        }
        try {
          await modelMaterializer.getQuery(`query:\n${malloyQuery.query}`);
        } catch (e) {
          // some errors come from Runtime stuff
          if (e instanceof MalloyError) {
            e.problems.forEach(log => {
              // "query:\n" adds a line, so we subtract the line here
              fixLogRange(uri, malloyQuery, log, -1);
            });
          }

          throw e;
        }
      }

      const model = await modelMaterializer?.getModel();
      if (model) {
        this.cache.set(uri, {version: currentVersion, model, baseUri});
      }
      return {model, baseUri};
    } else if (languageId === 'malloy-notebook') {
      // TODO(whscullin): Delete with malloy-sql text editor
      const parse = MalloySQLParser.parse(text, uri);

      let malloyStatements = '\n'.repeat(parse.initialCommentsLineCount || 0);
      for (const statement of parse.statements) {
        malloyStatements += '\n';
        if (statement.type === MalloySQLStatementType.MALLOY) {
          malloyStatements += statement.text;
        } else
          malloyStatements += `${'\n'.repeat(
            statement.text.split(/\r\n|\r|\n/).length - 1
          )}`;
      }

      // TODO is there some way I can just say "here's some text, use this URI for relative imports"?
      const files = {
        readURL: async (url: URL) => {
          return url.toString() === uri
            ? Promise.resolve(malloyStatements)
            : this.getDocumentText(this.documents, url);
        },
      };
      const runtime = new Runtime(
        files,
        this.connectionManager.getConnectionLookup(new URL(uri))
      );

      const mm = runtime.loadModel(new URL(uri));
      const model = await mm.getModel();
      const baseUri = uri;

      for (const statement of parse.statements.filter(
        (s): s is MalloySQLSQLStatement => s.type === MalloySQLStatementType.SQL
      )) {
        for (const malloyQuery of statement.embeddedMalloyQueries) {
          try {
            await mm.getQuery(`query:\n${malloyQuery.query}`);
          } catch (e) {
            if (e instanceof MalloyError) {
              e.problems.forEach(log => {
                fixLogRange(uri, malloyQuery, log, -1);
              });
            }
            throw e;
          }
        }
      }

      this.cache.set(uri, {version: currentVersion, model, baseUri});
      return {model, baseUri};
    } else {
      const files = {
        readURL: (url: URL) => this.getDocumentText(this.documents, url),
      };
      const runtime = new Runtime(
        files,
        this.connectionManager.getConnectionLookup(new URL(uri))
      );

      const {modelMaterializer, baseUri} = await this.createModelMaterializer(
        uri,
        runtime
      );
      const model = await modelMaterializer?.getModel();
      if (model) {
        this.cache.set(uri, {version: currentVersion, model, baseUri});
      }
      return {model, baseUri};
    }
  }
}

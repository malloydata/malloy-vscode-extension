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
import {fixLogRange} from '../common/malloy_sql';

const isNamedQuery = (object: NamedModelObject): object is NamedQuery =>
  object.type === 'query';

export class TranslateCache implements TranslateCache {
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
  ): Promise<ModelMaterializer | null> {
    let mm: ModelMaterializer | null = null;
    const queryFileURL = new URL(uri);
    if (queryFileURL.protocol === 'vscode-notebook-cell:') {
      const allCells = await this.getCellData(new URL(uri));
      for (const cell of allCells) {
        if (cell.languageId === 'malloy') {
          const url = new URL(cell.uri);
          if (mm) {
            mm = mm.extendModel(url);
          } else {
            mm = runtime.loadModel(url);
          }
        }
      }
    } else {
      mm = runtime.loadModel(queryFileURL);
    }
    return mm;
  }

  async getCellData(uri: URL): Promise<CellData[]> {
    return await this.connection.sendRequest('malloy/fetchCellData', {
      uri: uri.toString(),
    });
  }

  async translateWithCache(
    uri: string,
    currentVersion: number,
    languageId: string
  ): Promise<Model | undefined> {
    const entry = this.cache.get(uri);
    if (entry && entry.version === currentVersion) {
      return entry.model;
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

      const mm = await this.createModelMaterializer(uri, runtime);

      for (const malloyQuery of parse.embeddedMalloyQueries) {
        if (!mm) {
          throw new Error('Missing model definition');
        }
        try {
          await mm.getQuery(`query:\n${malloyQuery.query}`);
        } catch (e) {
          // some errors come from Runtime stuff
          if (e instanceof MalloyError) {
            e.problems.forEach(log => {
              fixLogRange(uri, malloyQuery, log);
            });
          }

          throw e;
        }
      }

      const model = await mm?.getModel();
      if (model) {
        this.cache.set(uri, {version: currentVersion, model});
      }
      return model;
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

      for (const statement of parse.statements.filter(
        (s): s is MalloySQLSQLStatement => s.type === MalloySQLStatementType.SQL
      )) {
        for (const malloyQuery of statement.embeddedMalloyQueries) {
          try {
            await mm.getQuery(`query:\n${malloyQuery.query}`);
          } catch (e) {
            if (e instanceof MalloyError) {
              e.problems.forEach(log => {
                fixLogRange(uri, malloyQuery, log);
              });
            }
            throw e;
          }
        }
      }

      this.cache.set(uri, {version: currentVersion, model});
      return model;
    } else {
      const files = {
        readURL: (url: URL) => this.getDocumentText(this.documents, url),
      };
      const runtime = new Runtime(
        files,
        this.connectionManager.getConnectionLookup(new URL(uri))
      );

      const mm = await this.createModelMaterializer(uri, runtime);
      const model = await mm?.getModel();
      if (model) {
        this.cache.set(uri, {version: currentVersion, model});
      }
      return model;
    }
  }
}

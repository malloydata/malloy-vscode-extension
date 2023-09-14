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
import {DocumentTextParse} from './completions/completions';

const isNamedQuery = (object: NamedModelObject): object is NamedQuery =>
  object.type === 'query';

export class TranslateCache implements TranslateCache {
  cache = new Map<string, {model: Model; version: number}>();
  truncatedCache = new Map<
    string,
    {model: Model; exploreCount: number, version: number}
  >();
  truncatedVersion: number = 0;

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

  async translateWithTruncatedCache(
    document: TextDocument,
    text: string,
    exploreCount: number,
    queriedSource: string
  ): Promise<Model | undefined> {
    const {uri, languageId} = document;
    if (languageId === 'malloy') {
      const entry = this.truncatedCache.get(uri);
      if (
        entry &&
        entry.exploreCount === exploreCount
      ) {
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
      const mm = await this.createModelMaterializer(uri, runtime);
      const model = await mm?.getModel();
      if (model) {
        this.truncatedCache.set(uri, {model, exploreCount, version: this.truncatedVersion++});
      }
      return model;
    }
    return undefined;
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
          if (!(e instanceof MalloyError)) {
            throw e;
          }

          e.problems.forEach(log => {
            if (log.at) {
              if (log.at.url === 'internal://internal.malloy') {
                log.at.url = uri;
              } else if (log.at.url !== uri) {
                return;
              }
              // if the embedded malloy is on the same line as SQL, pad character start (and maybe end)
              // "query:\n" adds a line, so we subtract the line here
              const embeddedStart: number = log.at.range.start.line - 1;
              if (embeddedStart === 0) {
                log.at.range.start.character +=
                  malloyQuery.malloyRange.start.character;
                if (log.at.range.start.line === log.at.range.end.line)
                  log.at.range.end.character +=
                    malloyQuery.malloyRange.start.character;
              }

              const lineDifference =
                log.at.range.end.line - log.at.range.start.line;
              log.at.range.start.line =
                malloyQuery.range.start.line + embeddedStart;
              log.at.range.end.line =
                malloyQuery.range.start.line + embeddedStart + lineDifference;
            }
          });

          throw e;
        }
      }

      const model = await mm?.getModel();
      if (model) {
        this.cache.set(uri, {version: currentVersion, model});
      }
      return model;
    } else if (languageId === 'malloy-notebook') {
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
            // some errors come from Runtime stuff
            if (!(e instanceof MalloyError)) {
              throw e;
            }

            e.problems.forEach(log => {
              if (log.at) {
                log.at.url = uri;

                // if the embedded malloy is on the same line as SQL, pad character start (and maybe end)
                // "query:\n" adds a line, so we subtract the line here
                const embeddedStart: number = log.at.range.start.line - 1;
                if (embeddedStart === 0) {
                  log.at.range.start.character +=
                    malloyQuery.malloyRange.start.character;
                  if (log.at.range.start.line === log.at.range.end.line)
                    log.at.range.end.character +=
                      malloyQuery.malloyRange.start.character;
                }

                const lineDifference =
                  log.at.range.end.line - log.at.range.start.line;
                log.at.range.start.line =
                  malloyQuery.range.start.line + embeddedStart;
                log.at.range.end.line =
                  malloyQuery.range.start.line + embeddedStart + lineDifference;
              }
            });

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

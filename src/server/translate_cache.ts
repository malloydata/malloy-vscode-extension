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
  SerializedExplore,
} from '@malloydata/malloy';
import {TextDocument} from 'vscode-languageserver-textdocument';

import {ConnectionManager} from '../common/connection_manager';
import {BuildModelRequest, CellData} from '../common/types';
import {
  MalloySQLParser,
  MalloySQLSQLStatement,
  MalloySQLStatementType,
} from '@malloydata/malloy-sql';

export class TranslateCache implements TranslateCache {
  cache = new Map<string, {model: Model; version: number}>();

  constructor(
    private documents: TextDocuments<TextDocument>,
    private connection: Connection,
    private connectionManager: ConnectionManager
  ) {
    connection.onRequest(
      'malloy/fetchModel',
      async (event: BuildModelRequest): Promise<SerializedExplore[]> => {
        const model = await this.translateWithCache(event.uri, event.version);
        return model.explores.map(explore => explore.toJSON());
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

  async getCellData(uri: URL): Promise<CellData[]> {
    return await this.connection.sendRequest('malloy/fetchCellData', {
      uri: uri.toString(),
    });
  }

  async translateWithCache(
    uri: string,
    currentVersion: number
  ): Promise<Model> {
    const entry = this.cache.get(uri);
    if (entry && entry.version === currentVersion) {
      return entry.model;
    }

    if (uri.toLowerCase().endsWith('.malloysql')) {
      const parse = MalloySQLParser.parse(
        await this.getDocumentText(this.documents, new URL(uri)),
        uri
      );

      let malloyStatements = '\n'.repeat(parse.initialCommentsLineCount);
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

            (e as MalloyError).problems.forEach(log => {
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
            });

            throw e;
          }
        }
      }

      return model;
    } else {
      const files = {
        readURL: (url: URL) => this.getDocumentText(this.documents, url),
      };
      const runtime = new Runtime(
        files,
        this.connectionManager.getConnectionLookup(new URL(uri))
      );

      let model: Model;

      if (uri.startsWith('vscode-notebook-cell:')) {
        const allCells = await this.getCellData(new URL(uri));
        let mm: ModelMaterializer | null = null;
        for (let idx = 0; idx < allCells.length; idx++) {
          const url = new URL(allCells[idx].uri);
          if (mm) {
            mm = mm.extendModel(url);
          } else {
            mm = runtime.loadModel(url);
          }
        }
        model = await mm.getModel();
      } else {
        model = await runtime.getModel(new URL(uri));
        this.cache.set(uri, {version: currentVersion, model});
      }
      return model;
    }
  }
}

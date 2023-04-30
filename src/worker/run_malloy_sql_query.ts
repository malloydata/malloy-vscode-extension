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
  MessageHandler,
  MessageRunMalloySQL,
  WorkerSQLQueryPanelMessage,
} from '../common/worker_message_types';

import {
  SQLQueryMessageType,
  SQLQueryPanelMessage,
  SQLQueryRunStatus,
} from '../common/message_types';
import {ConnectionManager} from '../common/connection_manager';
import {FileHandler} from '../common/types';
import {MalloyQueryData, Result, Runtime, URLReader} from '@malloydata/malloy';

interface QueryEntry {
  panelId: string;
  canceled: boolean;
}

interface EmbeddedMalloyTranslation {
  index: number;
  malloyQueryLength: number;
  generatedSQL: string;
}

const runningQueries: Record<string, QueryEntry> = {};

// Malloy needs to load model via a URI to know how to import relative model files, but we
// don't have a real URI because we're constructing the model from only parts of a real document.
// The actual URI we want to use is a .msql file that we don't want the compiler to load,
// so wrap the fileHandler to pretend the on-the-fly models have a URI
class VirtualURIFileHandler implements URLReader {
  private uriReader: URLReader;
  private url: URL;
  private contents: string;

  constructor(uriReader: URLReader) {
    this.uriReader = uriReader;
  }

  public setVirtualFile(url: URL, contents: string): void {
    this.url = url;
    this.contents = contents;
  }

  async readURL(uri: URL): Promise<string> {
    if (uri.toString() === this.url.toString()) {
      return this.contents;
    } else {
      const contents = await this.uriReader.readURL(uri);
      return contents;
    }
  }
}

// TODO panelId == document.uri.toString(), but it's not obvious from the name.
export const runMalloySQLQuery = async (
  messageHandler: MessageHandler,
  fileHandler: FileHandler,
  connectionManager: ConnectionManager,
  {panelId, query, connectionName, source, showSQLOnly}: MessageRunMalloySQL
): Promise<void> => {
  const sendMessage = (message: SQLQueryPanelMessage) => {
    const msg: WorkerSQLQueryPanelMessage = {
      type: 'malloy/SQLQueryPanel',
      panelId,
      message,
    };

    messageHandler.send(msg);
  };

  // conveniently, what we call panelId is also the document URI
  const url = new URL(panelId);
  runningQueries[panelId] = {panelId, canceled: false};

  try {
    if (connectionName === '')
      throw new Error(
        `Connection name cannot be empty.
The first comment in the file should define a connection like: "-- connection: bigquery"`
      );

    const connectionLookup = connectionManager.getConnectionLookup(
      new URL(connectionName + ':')
    );
    const connection = await connectionLookup.lookupConnection(connectionName);

    const malloyInSQLRegex = /\{%([\s\S]*?)%\}/g;
    const malloyQueries = [];
    let match = malloyInSQLRegex.exec(query);
    while (match) {
      malloyQueries.push(match);
      match = malloyInSQLRegex.exec(query);
    }
    const embeddedTranslations: EmbeddedMalloyTranslation[] = [];

    let sql = query;

    if (malloyQueries) {
      if (!source)
        throw new Error(
          `Found Malloy in query but no source was specified.
      The second comment in the file should define a source like: "-- source: ./airports"`
        );

      const virturlURIFileHandler = new VirtualURIFileHandler(fileHandler);
      const runtime = new Runtime(virturlURIFileHandler, connectionLookup);

      sendMessage({
        type: SQLQueryMessageType.QueryStatus,
        status: SQLQueryRunStatus.Compiling,
      });

      for (const malloyQueryMatch of malloyQueries) {
        if (runningQueries[panelId].canceled) return;

        const malloyQuery = malloyQueryMatch[1];

        // pad with newlines so that error messages line numbers are correct
        const queryStartSubstring = query.substring(0, malloyQueryMatch.index);
        const newlinesCount =
          queryStartSubstring.split(/\r\n|\r|\n/).length - 2;

        // TODO should table source be possible? seems useful. maybe shouldn't always be import
        const model = `import "${source}.malloy"\n${'\n'.repeat(
          newlinesCount
        )}query: ${malloyQuery}`;

        virturlURIFileHandler.setVirtualFile(url, model);
        const runnable = runtime.loadQueryByIndex(url, 0);

        runningQueries[panelId] = {panelId, canceled: false};

        const generatedSQL = await runnable.getSQL();
        if (runningQueries[panelId].canceled) return;

        embeddedTranslations.push({
          index: malloyQueryMatch.index,
          malloyQueryLength: malloyQuery.length,
          generatedSQL,
        });
      }

      if (runningQueries[panelId].canceled) return;

      while (embeddedTranslations.length > 0) {
        const nextMalloy = embeddedTranslations.shift();
        const before = sql.slice(0, nextMalloy.index);
        const after = sql.slice(
          nextMalloy.index + nextMalloy.malloyQueryLength + 4 // +4 for {%%}
        );
        sql = `${before}${nextMalloy.generatedSQL}${after}`;

        const indexShift =
          nextMalloy.generatedSQL.length - (nextMalloy.malloyQueryLength + 4);

        embeddedTranslations.forEach(
          translation => (translation.index += indexShift)
        );
      }

      sendMessage({
        type: SQLQueryMessageType.QueryStatus,
        status: SQLQueryRunStatus.Compiled,
        sql,
        showSQLOnly,
      });

      messageHandler.log(sql);

      if (showSQLOnly) return;
    }

    sendMessage({
      type: SQLQueryMessageType.QueryStatus,
      status: SQLQueryRunStatus.Running,
      sql,
    });

    let structDefResult;
    let sqlResult: MalloyQueryData;
    try {
      // get structDef from schema, that way we can render with fake Results object.
      // it would probably be better to do this without a database round-trip since we are
      // only faking this for the sake of fitting into the render library but I don't know how
      // to fake an entire structdef
      structDefResult = await connection.fetchSchemaForSQLBlock({
        type: 'sqlBlock',
        selectStr: sql,
        name: sql,
      });

      if (structDefResult.error) {
        throw new Error(structDefResult.error);
      }

      sqlResult = await connection.runSQL(sql);
    } catch (error) {
      sendMessage({
        type: SQLQueryMessageType.QueryStatus,
        status: SQLQueryRunStatus.Error,
        error: error.message,
        sql, // if we have an error in this try-to-run-sql block, send back computed SQL for debugging
      });
      return;
    }

    if (runningQueries[panelId].canceled) return;

    // Fake a Result for rendering purposes using the structdef we got above
    const results = new Result(
      {
        structs: [structDefResult.structDef],
        sql,
        result: sqlResult.rows,
        totalRows: sqlResult.totalRows,
        lastStageName: sql,
        malloy: '',
        connectionName,
        sourceExplore: '',
        sourceFilters: [],
      },
      {
        name: 'empty_model',
        exports: [],
        contents: {},
      }
    );

    sendMessage({
      type: SQLQueryMessageType.QueryStatus,
      status: SQLQueryRunStatus.Done,
      results: results.toJSON(),
    });
  } catch (error) {
    sendMessage({
      type: SQLQueryMessageType.QueryStatus,
      status: SQLQueryRunStatus.Error,
      error: error.message,
    });
  }
};

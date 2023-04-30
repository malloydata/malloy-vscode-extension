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
import {Runtime, URLReader} from '@malloydata/malloy';

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
// don't have a real URI because we're constructing the model files on the fly,
// and the actual URI we want to use is a .malloysql file that we don't want the compiler to load,
// so as a hack, wrap the fileHandler to pretend the on-the-fly models have a URI
class HackyVirtualURIFileHandler implements URLReader {
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
  {panelId, query, connectionName, source}: MessageRunMalloySQL
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

      const virturlURIFileHandler = new HackyVirtualURIFileHandler(fileHandler);
      const runtime = new Runtime(virturlURIFileHandler, connectionLookup);

      for (const malloyQueryMatch of malloyQueries) {
        const malloyQuery = malloyQueryMatch[1];

        // pad with newlines so that error messages line numbers are reasonable
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
        sendMessage({
          type: SQLQueryMessageType.QueryStatus,
          status: SQLQueryRunStatus.Compiling,
        });

        const generatedSQL = await runnable.getSQL();
        if (runningQueries[panelId].canceled) return;

        messageHandler.log(generatedSQL);

        sendMessage({
          type: SQLQueryMessageType.QueryStatus,
          status: SQLQueryRunStatus.Compiled,
          sql: generatedSQL,
        });

        embeddedTranslations.push({
          index: malloyQueryMatch.index,
          malloyQueryLength: malloyQuery.length,
          generatedSQL,
        });
      }

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
    }

    sendMessage({
      type: SQLQueryMessageType.QueryStatus,
      status: SQLQueryRunStatus.Running,
      sql,
    });

    const sqlResult = await connection.runSQL(sql);
    if (runningQueries[panelId].canceled) return;

    sendMessage({
      type: SQLQueryMessageType.QueryStatus,
      status: SQLQueryRunStatus.Done,
      results: sqlResult,
    });
  } catch (error) {
    sendMessage({
      type: SQLQueryMessageType.QueryStatus,
      status: SQLQueryRunStatus.Error,
      error: error.message,
    });
  } finally {
    delete runningQueries[panelId];
  }
};

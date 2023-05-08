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
  MessageRunMSQL,
  WorkerSQLQueryPanelMessage as WorkerMSQLQueryPanelMessage,
} from '../common/worker_message_types';

import {
  EvaluatedMSQLStatement,
  EvaluatedMSQLStatementType,
  ExecutedMSQLStatementResultType,
  MSQLMessageType,
  MSQLQueryPanelMessage,
  MSQLQueryRunStatus,
} from '../common/message_types';
import {ConnectionManager} from '../common/connection_manager';
import {FileHandler} from '../common/types';
import {MalloyQueryData, Result, Runtime, URLReader} from '@malloydata/malloy';

interface QueryEntry {
  panelId: string;
  canceled: boolean;
}

const runningQueries: Record<string, QueryEntry> = {};
const malloyInSQLRegex = /%\{([\s\S]*?)\}%/g;

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
export const runMSQLQuery = async (
  messageHandler: MessageHandler,
  fileHandler: FileHandler,
  connectionManager: ConnectionManager,
  {
    panelId,
    malloySQLQuery,
    connectionName,
    statementIndex,
    importURL,
    showSQLOnly,
  }: MessageRunMSQL
): Promise<void> => {
  const sendMessage = (message: MSQLQueryPanelMessage) => {
    const msg: WorkerMSQLQueryPanelMessage = {
      type: 'malloy/MSQLQueryPanel',
      panelId,
      message,
    };

    messageHandler.send(msg);
  };

  // conveniently, what we call panelId is also the document URI
  const url = new URL(panelId);
  runningQueries[panelId] = {panelId, canceled: false};
  const evaluatedStatements: EvaluatedMSQLStatement[] = [];
  const abortOnExecutionError = true;

  try {
    if (connectionName === '')
      throw new Error(
        'Connection name cannot be empty. Add a comment to specify the connection like: --! connection: bigquery'
      );

    const connectionLookup = connectionManager.getConnectionLookup(url);
    const connection = await connectionLookup.lookupConnection(connectionName);
    const virturlURIFileHandler = new VirtualURIFileHandler(fileHandler);
    const runtime = new Runtime(virturlURIFileHandler, connectionLookup);

    let statements = malloySQLQuery.split(';;;');
    if (statementIndex) statements = [statements[statementIndex]];

    // TODO remove when actually parsing
    if (
      statements.length > 0 &&
      statements[statements.length - 1].trim() === ''
    )
      statements.pop();

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      const malloyQueries = [];
      let match = malloyInSQLRegex.exec(statement);
      while (match) {
        malloyQueries.push(match);
        match = malloyInSQLRegex.exec(statement);
      }

      let compiledStatement = statement;
      compiledStatement = compiledStatement.trim();

      const compileErrors = [];

      // if user ended stmt with semicolon, as many might in a single-query file,
      // strip it
      if (compiledStatement.charAt(compiledStatement.length - 1) === ';')
        compiledStatement = compiledStatement.slice(0, -1);

      if (malloyQueries.length > 0) {
        if (!importURL)
          throw new Error(
            'Found Malloy in query but no import was specified. Add a comment to specify an import like: --! import: "mysource.malloy"'
          );

        sendMessage({
          type: MSQLMessageType.QueryStatus,
          status: MSQLQueryRunStatus.Compiling,
          totalStatements: statements.length,
          statementIndex: i,
        });

        for (const malloyQueryMatch of malloyQueries) {
          if (runningQueries[panelId].canceled) return;

          const malloyQuery = malloyQueryMatch[1];

          // pad with newlines so that error messages line numbers are correct
          // TODO also pad with prior queries length
          let newlinesCount =
            malloySQLQuery.slice(0, malloyQueryMatch.index).split(/\r\n|\r|\n/)
              .length - 2;
          if (newlinesCount < 0) newlinesCount = 1;

          const model = `import ${importURL}\n${'\n'.repeat(
            newlinesCount
          )}query: ${malloyQuery}`;

          virturlURIFileHandler.setVirtualFile(url, model);
          runningQueries[panelId] = {panelId, canceled: false};

          try {
            const runnable = runtime.loadQueryByIndex(url, 0);
            const generatedSQL = await runnable.getSQL();

            compiledStatement = compiledStatement.replace(
              `%{${malloyQuery}}%`,
              generatedSQL
            );
          } catch (e) {
            compileErrors.push(e);
          }

          if (runningQueries[panelId].canceled) return;
        }
      }

      if (compileErrors.length > 0) {
        evaluatedStatements.push({
          type: EvaluatedMSQLStatementType.CompileError,
          errors: compileErrors,
          statementIndex: i,
        });
      } else if (showSQLOnly) {
        evaluatedStatements.push({
          type: EvaluatedMSQLStatementType.Compiled,
          compiledStatement,
          statementIndex: i,
        });
      } else {
        sendMessage({
          type: MSQLMessageType.QueryStatus,
          status: MSQLQueryRunStatus.Running,
          totalStatements: statements.length,
          statementIndex: i,
        });

        messageHandler.log(compiledStatement);

        try {
          const sqlResults = await connection.runSQL(compiledStatement);

          // rendering is nice if we can do it. try to get a structdef for the last query,
          // and if we get one, return Result object for rendering
          const structDefAttempt = await connection.fetchSchemaForSQLBlock({
            type: 'sqlBlock',
            selectStr: compiledStatement,
            name: compiledStatement,
          });

          structDefAttempt.error
            ? evaluatedStatements.push({
                type: EvaluatedMSQLStatementType.Executed,
                resultType: ExecutedMSQLStatementResultType.WithoutStructdef,
                results: sqlResults,
                compiledStatement,
                statementIndex: i,
              })
            : evaluatedStatements.push({
                type: EvaluatedMSQLStatementType.Executed,
                resultType: ExecutedMSQLStatementResultType.WithStructdef,
                results: fakeMalloyResult(
                  structDefAttempt,
                  compiledStatement,
                  sqlResults,
                  connectionName
                ).toJSON(),
                compiledStatement,
                statementIndex: i,
              });
        } catch (error) {
          evaluatedStatements.push({
            type: EvaluatedMSQLStatementType.ExecutionError,
            error: error.message,
            compiledStatement,
            statementIndex: i,
          });

          if (abortOnExecutionError) break;
        }
      }

      if (runningQueries[panelId].canceled) return;
    }

    sendMessage({
      type: MSQLMessageType.QueryStatus,
      status: MSQLQueryRunStatus.Done,
      results: evaluatedStatements,
      showSQLOnly,
    });
  } catch (error) {
    sendMessage({
      type: MSQLMessageType.QueryStatus,
      status: MSQLQueryRunStatus.Error,
      error: error.message,
    });
  }
};

const fakeMalloyResult = (
  structDefResult,
  sql: string,
  sqlResult: MalloyQueryData,
  connectionName: string
): Result => {
  return new Result(
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
};

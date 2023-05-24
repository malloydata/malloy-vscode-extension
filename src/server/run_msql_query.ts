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
import {
  MalloyQueryData,
  ModelMaterializer,
  Result,
  Runtime,
  URLReader,
} from '@malloydata/malloy';
import {MalloySQLStatementType, MalloySQLParser} from '@malloydata/malloy-sql';

interface QueryEntry {
  panelId: string;
  canceled: boolean;
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
export const runMSQLQuery = async (
  messageHandler: MessageHandler,
  fileHandler: FileHandler,
  connectionManager: ConnectionManager,
  {panelId, malloySQLQuery, statementIndex, showSQLOnly}: MessageRunMSQL
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
  const evaluatedStatements: EvaluatedMSQLStatement[] = [];
  const abortOnExecutionError = true;

  // TODO
  runningQueries[panelId] = {panelId, canceled: false};
  const virturlURIFileHandler = new VirtualURIFileHandler(fileHandler);
  let modelMaterializer: ModelMaterializer;

  try {
    const parse = MalloySQLParser.parse(malloySQLQuery);
    if (parse.error) {
      sendMessage({
        type: MSQLMessageType.QueryStatus,
        status: MSQLQueryRunStatus.Error,
        error: parse.error.message,
      });
    }
    const statements = parse.statements;
    let malloyRuntime: Runtime;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      let compiledStatement = statement.statementText;
      const compileErrors = [];

      sendMessage({
        type: MSQLMessageType.QueryStatus,
        status: MSQLQueryRunStatus.Compiling,
        totalStatements: statements.length,
        statementIndex: i,
      });

      const connectionLookup = connectionManager.getConnectionLookup(url);

      if (statement.type === MalloySQLStatementType.MALLOY) {
        virturlURIFileHandler.setVirtualFile(url, statement.statementText);

        if (!malloyRuntime)
          malloyRuntime = new Runtime(
            virturlURIFileHandler,
            connectionManager.getConnectionLookup(url)
          );

        try {
          if (!modelMaterializer) {
            modelMaterializer = malloyRuntime.loadModel(url);
          } else {
            modelMaterializer.extendModel(url);
          }

          try {
            const model = modelMaterializer.getModel();

            /*
            const finalQuery = modelMaterializer.loadQuery(url);
            // TODO test this, what if there is no final query
            sendMessage({
              type: MSQLMessageType.QueryStatus,
              status: MSQLQueryRunStatus.Running,
              totalStatements: statements.length,
              statementIndex: i,
            });

            TODO this doesn't seem right but is the way Lloyd said to do it, need to discuss
            const results = await finalQuery.run();

            evaluatedStatements.push({
              type: EvaluatedMSQLStatementType.Executed,
              resultType: ExecutedMSQLStatementResultType.WithStructdef,
              results: results.toJSON(),
              compiledStatement,
              statementIndex: i,
            }); */
          } catch (error) {
            evaluatedStatements.push({
              type: EvaluatedMSQLStatementType.ExecutionError,
              error: error.message,
              compiledStatement,
              statementIndex: i,
              statementFirstLine: statement.range.start.line,
            });

            if (abortOnExecutionError) break;
          }
        } catch (error) {
          evaluatedStatements.push({
            type: EvaluatedMSQLStatementType.CompileError,
            errors: error,
            statementIndex: i,
          });
        }
      } else if (statement.type === MalloySQLStatementType.SQL) {
        sendMessage({
          type: MSQLMessageType.QueryStatus,
          status: MSQLQueryRunStatus.Compiling,
          totalStatements: statements.length,
          statementIndex: i,
        });

        for (const malloyQuery of statement.embeddedMalloyQueries) {
          if (runningQueries[panelId].canceled) return;

          // TODO pad with newlines so that error messages line numbers are correct
          // TODO also pad with prior queries length?

          // TODO
          //runningQueries[panelId] = {panelId, canceled: false};

          try {
            // TODO assumes modelMaterializer exists, because >>>malloy always happens before >>>sql with embedded malloy
            const runnable = modelMaterializer.loadQuery(
              `\nquery: ${malloyQuery.query}`
            );
            const generatedSQL = await runnable.getSQL();

            const replaceString = malloyQuery.parenthized
              ? `(%{${malloyQuery.query}}%)`
              : `%{${malloyQuery.query}}%`;

            compiledStatement = compiledStatement.replace(
              replaceString,
              `(${generatedSQL})`
            );
          } catch (e) {
            compileErrors.push(e);
          }
        }

        if (compileErrors.length > 0) {
          evaluatedStatements.push({
            type: EvaluatedMSQLStatementType.CompileError,
            errors: compileErrors,
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
            const connection = await connectionLookup.lookupConnection(
              statement.config.connection
            );
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
                    statement.config.connection
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
              statementFirstLine: statement.range.start.line,
            });

            if (abortOnExecutionError) break;
          }
          if (i === statementIndex) break;
        }

        // TODO
        if (runningQueries[panelId].canceled) return;
      }
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

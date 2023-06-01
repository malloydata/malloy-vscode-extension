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
  MessageCancel,
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
// The actual URI we want to use is a .malloysql file that we don't want the compiler to load,
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

// panelId == document.uri.toString(), but it's not obvious from the name.
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

  runningQueries[panelId] = {panelId, canceled: false};
  const virturlURIFileHandler = new VirtualURIFileHandler(fileHandler);
  let modelMaterializer: ModelMaterializer;

  try {
    const parse = MalloySQLParser.parse(malloySQLQuery, panelId);
    if (parse.errors.length > 0) {
      sendMessage({
        type: MSQLMessageType.QueryStatus,
        status: MSQLQueryRunStatus.Error,
        error: parse.errors.map(e => e.message).join('\n'),
      });
      return;
    }
    const statements = parse.statements;
    const malloyRuntime = new Runtime(
      virturlURIFileHandler,
      connectionManager.getConnectionLookup(url)
    );

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // don't evaluate SQL statements if statmentIndex passed unless we're on
      // the exact index
      if (
        statement.type === MalloySQLStatementType.SQL &&
        statementIndex !== null &&
        statementIndex !== i
      )
        continue;

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

        try {
          if (!modelMaterializer) {
            modelMaterializer = malloyRuntime.loadModel(url);
          } else {
            modelMaterializer.extendModel(url);
          }

          try {
            const _model = modelMaterializer.getModel();
            if (runningQueries[panelId].canceled) return;

            // the only way to know if there's a query in this statement is to try
            // to run query by index and catch if it fails. If it fails, we have compiled but nothing
            // was executed.
            try {
              sendMessage({
                type: MSQLMessageType.QueryStatus,
                status: MSQLQueryRunStatus.Running,
                totalStatements: statements.length,
                statementIndex: i,
              });

              const finalQuery = modelMaterializer.loadQuery(url);
              const results = await finalQuery.run();

              evaluatedStatements.push({
                type: EvaluatedMSQLStatementType.Executed,
                resultType: ExecutedMSQLStatementResultType.WithStructdef,
                results: results.toJSON(),
                compiledStatement,
                statementIndex: i,
              });
            } catch (e) {
              // TODO this error is thrown from Model and could be improved such that we can ensure we're catching
              // what we expect here
              // if error is ThereIsNoQueryHere:
              evaluatedStatements.push({
                type: EvaluatedMSQLStatementType.Compiled,
                compiledStatement,
                statementIndex: i,
              });
              // else if (abortOnExecutionError) break;
            }
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

        if (runningQueries[panelId].canceled) return;

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
            const connection = await connectionLookup.lookupConnection(
              statement.config.connection
            );
            const sqlResults = await connection.runSQL(compiledStatement);

            if (runningQueries[panelId].canceled) return;

            // rendering is nice if we can do it. try to get a structdef for the last query,
            // and if we get one, return Result object for rendering
            const structDefAttempt = await connection.fetchSchemaForSQLBlock({
              type: 'sqlBlock',
              selectStr: compiledStatement,
              name: compiledStatement,
            });

            if (runningQueries[panelId].canceled) return;

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
        }

        if (runningQueries[panelId].canceled) return;
      }
      if (i === statementIndex) break;
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

export const cancelMSQLQuery = ({panelId}: MessageCancel): void => {
  if (runningQueries[panelId]) {
    runningQueries[panelId].canceled = true;
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

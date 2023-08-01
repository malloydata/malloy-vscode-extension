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
  WorkerMessageHandler,
  MessageRunMSQL,
} from '../common/worker_message_types';

import {
  EvaluatedMSQLStatement,
  EvaluatedMSQLStatementType,
  ExecutedMSQLStatementResultType,
  MSQLMessageStatus,
  MSQLQueryPanelMessage,
  MSQLQueryRunStatus,
} from '../common/message_types';
import {ConnectionManager} from '../common/connection_manager';
import {
  FileHandler,
  StructDefSuccess,
  isStructDefFailure,
} from '../common/types';
import {
  MalloyError,
  MalloyQueryData,
  ModelMaterializer,
  Result,
  Runtime,
  URLReader,
} from '@malloydata/malloy';
import {MalloySQLStatementType, MalloySQLParser} from '@malloydata/malloy-sql';
import {CancellationToken, ProgressType} from 'vscode-jsonrpc';
import {errorMessage} from '../common/errors';

// Malloy needs to load model via a URI to know how to import relative model files, but we
// don't have a real URI because we're constructing the model from only parts of a real document.
// The actual URI we want to use is a .malloysql file that we don't want the compiler to load,
// so wrap the fileHandler to pretend the on-the-fly models have a URI
class VirtualURIFileHandler implements URLReader {
  private uriReader: URLReader;
  private url: URL | null = null;
  private contents: string | null = null;

  constructor(uriReader: URLReader) {
    this.uriReader = uriReader;
  }

  public setVirtualFile(url: URL, contents: string): void {
    this.url = url;
    this.contents = contents;
  }

  async readURL(uri: URL): Promise<string> {
    if (uri.toString() === this.url?.toString()) {
      return this.contents || '';
    } else {
      const contents = await this.uriReader.readURL(uri);
      return contents;
    }
  }
}

// panelId == document.uri.toString(), but it's not obvious from the name.
export const runMSQLQuery = async (
  messageHandler: WorkerMessageHandler,
  fileHandler: FileHandler,
  connectionManager: ConnectionManager,
  {panelId, malloySQLQuery, statementIndex, showSQLOnly}: MessageRunMSQL,
  cancellationToken: CancellationToken
): Promise<void> => {
  const sendMessage = (message: MSQLQueryPanelMessage) => {
    const progress = new ProgressType<MSQLMessageStatus>();

    messageHandler.sendProgress(progress, panelId, message);
  };

  // conveniently, what we call panelId is also the document URI
  const url = new URL(panelId);
  const evaluatedStatements: EvaluatedMSQLStatement[] = [];
  const abortOnExecutionError = true;

  const virtualURIFileHandler = new VirtualURIFileHandler(fileHandler);
  let modelMaterializer: ModelMaterializer | null = null;

  try {
    const parse = MalloySQLParser.parse(malloySQLQuery, panelId);
    if (parse.errors.length > 0) {
      sendMessage({
        status: MSQLQueryRunStatus.Error,
        error: parse.errors.map(e => e.message).join('\n'),
      });
      return;
    }
    const statements = parse.statements;
    const malloyRuntime = new Runtime(
      virtualURIFileHandler,
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

      let compiledStatement = statement.text;
      const compileErrors: MalloyError[] = [];

      sendMessage({
        status: MSQLQueryRunStatus.Compiling,
        totalStatements: statements.length,
        statementIndex: i,
      });

      const connectionLookup = connectionManager.getConnectionLookup(url);

      if (statement.type === MalloySQLStatementType.MALLOY) {
        virtualURIFileHandler.setVirtualFile(url, statement.text);

        try {
          if (!modelMaterializer) {
            modelMaterializer = malloyRuntime.loadModel(url);
          } else {
            modelMaterializer.extendModel(url);
          }

          const _model = modelMaterializer.getModel();
          if (cancellationToken.isCancellationRequested) return;

          // the only way to know if there's a query in this statement is to try
          // to run query by index and catch if it fails.
          try {
            const finalQuery = modelMaterializer.loadQuery(url);
            const finalQuerySQL = await finalQuery.getSQL();

            if (showSQLOnly) {
              evaluatedStatements.push({
                type: EvaluatedMSQLStatementType.Compiled,
                compiledStatement: finalQuerySQL,
                statementIndex: i,
              });
            } else {
              sendMessage({
                status: MSQLQueryRunStatus.Running,
                totalStatements: statements.length,
                statementIndex: i,
              });

              try {
                const results = await finalQuery.run();

                evaluatedStatements.push({
                  type: EvaluatedMSQLStatementType.Executed,
                  resultType: ExecutedMSQLStatementResultType.WithStructdef,
                  results: results.toJSON(),
                  compiledStatement: finalQuerySQL,
                  statementIndex: i,
                });
              } catch (error) {
                evaluatedStatements.push({
                  type: EvaluatedMSQLStatementType.ExecutionError,
                  error: errorMessage(error),
                  compiledStatement,
                  statementIndex: i,
                  statementFirstLine: statement.range.start.line,
                });

                if (abortOnExecutionError) break;
              }
            }
          } catch (error) {
            // TODO this error is thrown from Model and could be improved such that we can ensure we're catching
            // what we expect here
            // if error is ThereIsNoQueryHere:
            evaluatedStatements.push({
              type: EvaluatedMSQLStatementType.Compiled,
              compiledStatement: 'Nothing to execute',
              statementIndex: i,
            });
            // else if (abortOnExecutionError) break;
          }
        } catch (error) {
          if (error instanceof MalloyError) {
            evaluatedStatements.push({
              type: EvaluatedMSQLStatementType.CompileError,
              errors: [error],
              statementIndex: i,
            });
          } else {
            throw error;
          }
        }
      } else if (statement.type === MalloySQLStatementType.SQL) {
        sendMessage({
          status: MSQLQueryRunStatus.Compiling,
          totalStatements: statements.length,
          statementIndex: i,
        });

        for (const malloyQuery of statement.embeddedMalloyQueries) {
          if (!modelMaterializer) {
            throw new Error('Missing model definition');
          }
          try {
            const runnable = modelMaterializer.loadQuery(
              `\nquery: ${malloyQuery.query}`
            );
            const generatedSQL = await runnable.getSQL();

            compiledStatement = compiledStatement.replace(
              malloyQuery.text,
              `(${generatedSQL})`
            );
          } catch (e) {
            if (e instanceof MalloyError) {
              compileErrors.push(e);
            } else {
              throw e;
            }
          }
        }

        if (cancellationToken.isCancellationRequested) return;

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
            status: MSQLQueryRunStatus.Running,
            totalStatements: statements.length,
            statementIndex: i,
          });

          messageHandler.log(compiledStatement);

          try {
            const connection = await connectionLookup.lookupConnection(
              statement.config?.connection || 'unknown'
            );
            const sqlResults = await connection.runSQL(compiledStatement);

            if (cancellationToken.isCancellationRequested) return;

            // rendering is nice if we can do it. try to get a structdef for the last query,
            // and if we get one, return Result object for rendering
            const structDefAttempt = await connection.fetchSchemaForSQLBlock({
              type: 'sqlBlock',
              selectStr: compiledStatement
                .replaceAll(/^--[^\n]*$/gm, '') // Remove comments
                .replace(/;\s*$/, ''), // Remove trailing `;`,
              name: compiledStatement,
            });

            if (cancellationToken.isCancellationRequested) return;

            isStructDefFailure(structDefAttempt)
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
                    statement.config?.connection || 'unknown'
                  ).toJSON(),
                  compiledStatement,
                  statementIndex: i,
                });
          } catch (error) {
            evaluatedStatements.push({
              type: EvaluatedMSQLStatementType.ExecutionError,
              error: errorMessage(error),
              compiledStatement,
              statementIndex: i,
              statementFirstLine: statement.range.start.line,
            });

            if (abortOnExecutionError) break;
          }
        }

        if (cancellationToken.isCancellationRequested) return;
      }
      if (i === statementIndex) break;
    }

    sendMessage({
      status: MSQLQueryRunStatus.Done,
      results: evaluatedStatements,
      showSQLOnly,
    });
  } catch (error) {
    sendMessage({
      status: MSQLQueryRunStatus.Error,
      error: errorMessage(error),
    });
  }
};

const fakeMalloyResult = (
  structDefResult: StructDefSuccess,
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

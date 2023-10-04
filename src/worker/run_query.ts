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
  MalloyError,
  MalloyQueryData,
  QueryMaterializer,
  Result,
  Runtime,
  SerializedExplore,
} from '@malloydata/malloy';
import {MalloySQLSQLParser} from '@malloydata/malloy-sql';
import {DataStyles} from '@malloydata/render';

import {WorkerMessageHandler, MessageRun} from '../common/worker_message_types';

import {QueryMessageStatus, QueryRunStatus} from '../common/message_types';
import {createModelMaterializer, createRunnable} from './create_runnable';
import {ConnectionManager} from '../common/connection_manager';
import {Cell, CellData, FileHandler, StructDefResult} from '../common/types';
import {CancellationToken, ProgressType} from 'vscode-jsonrpc';
import {errorMessage} from '../common/errors';
import {fixLogRange} from '../common/malloy_sql';

const fakeMalloyResult = (
  {structDef}: StructDefResult,
  sql: string,
  {rows: result, totalRows, runStats}: MalloyQueryData,
  connectionName: string
): Result => {
  return new Result(
    {
      structs: structDef ? [structDef] : [],
      sql,
      result,
      totalRows,
      lastStageName: sql,
      malloy: '',
      connectionName,
      runStats,
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

// Cell metadata doesn't get updated when editing yet so re-parse
// each preceding cell to see if a connection has been defined

const computeConnectionName = (cellData: CellData | null) => {
  let connectionName = 'unknown';
  for (const cell of cellData?.cells || []) {
    if (cell.languageId !== 'malloy-sql') {
      continue;
    }
    const parsed = MalloySQLSQLParser.parse(cell.text);
    if (parsed.config.connection) {
      connectionName = parsed.config.connection;
    }
  }
  return connectionName;
};

const runMSQLCell = async (
  messageHandler: WorkerMessageHandler,
  files: FileHandler,
  connectionManager: ConnectionManager,
  {query, panelId, showSQLOnly}: MessageRun,
  cellData: CellData | null,
  currentCell: Cell,
  cancellationToken: CancellationToken
) => {
  const sendMessage = (message: QueryMessageStatus) => {
    const progress = new ProgressType<QueryMessageStatus>();
    console.debug('sendMessage', panelId, message.status);
    messageHandler.sendProgress(progress, panelId, message);
  };

  const url = new URL(query.uri);
  const connectionLookup = connectionManager.getConnectionLookup(url);

  const runtime = new Runtime(files, connectionLookup);
  const allBegin = Date.now();
  const compileBegin = allBegin;
  sendMessage({
    status: QueryRunStatus.Compiling,
  });

  const modelMaterializer = await createModelMaterializer(
    query.uri,
    runtime,
    cellData
  );

  const connectionName = computeConnectionName(cellData);
  const parsed = MalloySQLSQLParser.parse(currentCell.text, currentCell.uri);

  let compiledStatement = currentCell.text;
  const dialect = 'unknown';

  for (const malloyQuery of parsed.embeddedMalloyQueries) {
    if (!modelMaterializer) {
      throw new Error('Missing model definition');
    }
    try {
      const runnable = modelMaterializer.loadQuery(
        `\nrun: ${malloyQuery.query}`
      );
      const generatedSQL = await runnable.getSQL();

      compiledStatement = compiledStatement.replace(
        malloyQuery.text,
        `(${generatedSQL})`
      );
    } catch (e) {
      if (e instanceof MalloyError) {
        let message = 'Error: ';
        e.problems.forEach(log => {
          message += fixLogRange(query.uri, malloyQuery, log);
        });
        throw new MalloyError(message, e.problems);
      }
      throw e;
    }
  }

  const dataStyles: DataStyles = {};
  if (cancellationToken.isCancellationRequested) return;

  console.info(compiledStatement);

  sendMessage({
    status: QueryRunStatus.Compiled,
    sql: compiledStatement,
    dialect,
    showSQLOnly,
  });

  if (showSQLOnly) {
    sendMessage({
      status: QueryRunStatus.EstimatedCost,
      queryCostBytes: undefined,
      schema: [],
    });
    return;
  }

  const runBegin = Date.now();
  sendMessage({
    status: QueryRunStatus.Running,
    sql: compiledStatement,
    dialect,
  });

  const connection = await connectionLookup.lookupConnection(connectionName);

  const sqlResults = await connection.runSQL(compiledStatement);

  if (cancellationToken.isCancellationRequested) return;

  // rendering is nice if we can do it. try to get a structdef for the last query,
  // and if we get one, return Result object for rendering
  const structDefAttempt = await connection.fetchSchemaForSQLBlock(
    {
      type: 'sqlBlock',
      selectStr: compiledStatement
        .replaceAll(/^--[^\n]*$/gm, '') // Remove comments
        .replace(/;\s*$/, ''), // Remove trailing `;`
      name: compiledStatement,
    },
    {refreshSchemaCache: false}
  );

  if (cancellationToken.isCancellationRequested) return;

  const queryResult = fakeMalloyResult(
    structDefAttempt,
    compiledStatement,
    sqlResults,
    connectionName
  );

  // Calculate execution times.
  const runFinish = Date.now();
  const compileTime = elapsedTime(compileBegin, runBegin);
  const runTime = elapsedTime(runBegin, runFinish);
  const totalTime = elapsedTime(allBegin, runFinish);

  sendMessage({
    status: QueryRunStatus.Done,
    resultJson: queryResult.toJSON(),
    dataStyles,
    canDownloadStream: false,
    stats: {
      compileTime,
      runTime,
      totalTime,
    },
  });

  return;
};

export const runQuery = async (
  messageHandler: WorkerMessageHandler,
  fileHandler: FileHandler,
  connectionManager: ConnectionManager,
  isBrowser: boolean,
  messageRun: MessageRun,
  cancellationToken: CancellationToken
): Promise<void> => {
  const {query, panelId, showSQLOnly, defaultTab} = messageRun;

  const sendMessage = (message: QueryMessageStatus) => {
    console.debug('sendMessage', panelId, message.status);
    const progress = new ProgressType<QueryMessageStatus>();
    messageHandler.sendProgress(progress, panelId, message);
  };

  const url = new URL(query.uri);
  const connectionLookup = connectionManager.getConnectionLookup(url);

  try {
    const queryFileURL = new URL(query.uri);
    let cellData: CellData | null = null;
    let currentCell: Cell | null = null;
    let isMalloySql = false;

    if (queryFileURL.protocol === 'vscode-notebook-cell:') {
      cellData = await fileHandler.fetchCellData(query.uri);
      currentCell = cellData.cells[cellData.cells.length - 1];
      isMalloySql = currentCell.languageId === 'malloy-sql';
    }

    if (isMalloySql) {
      if (currentCell) {
        await runMSQLCell(
          messageHandler,
          fileHandler,
          connectionManager,
          messageRun,
          cellData,
          currentCell,
          cancellationToken
        );
      } else {
        throw new Error('Unexpected state: Malloy SQL outside of notebook');
      }
      return;
    }

    const runtime = new Runtime(fileHandler, connectionLookup);
    const allBegin = Date.now();
    const compileBegin = allBegin;
    sendMessage({
      status: QueryRunStatus.Compiling,
    });

    let sql: string;
    const runnable = await createRunnable(query, runtime, cellData);

    // Set the row limit to the limit provided in the final stage of the query, if present
    const rowLimit =
      runnable instanceof QueryMaterializer
        ? (await runnable.getPreparedResult()).resultExplore.limit
        : undefined;

    const dialect =
      (runnable instanceof QueryMaterializer
        ? (await runnable.getPreparedQuery()).dialect
        : undefined) || 'unknown';

    try {
      sql = await runnable.getSQL();
      if (cancellationToken.isCancellationRequested) return;
      console.info(sql);

      sendMessage({
        status: QueryRunStatus.Compiled,
        sql,
        dialect,
        showSQLOnly,
      });

      if (showSQLOnly) {
        const schema: SerializedExplore[] = [];
        if ('getPreparedQuery' in runnable) {
          const query = await runnable.getPreparedQuery();
          schema.push(query.preparedResult.resultExplore.toJSON());
        }
        const estimatedRunStats = await runnable.estimateQueryCost();
        sendMessage({
          status: QueryRunStatus.EstimatedCost,
          queryCostBytes: estimatedRunStats?.queryCostBytes,
          schema,
        });
        return;
      }
    } catch (error) {
      sendMessage({
        status: QueryRunStatus.Error,
        error: errorMessage(error),
      });
      return;
    }

    const runBegin = Date.now();
    sendMessage({
      status: QueryRunStatus.Running,
      sql,
      dialect,
    });
    const queryResult = await runnable.run({rowLimit});
    if (cancellationToken.isCancellationRequested) return;

    // Calculate execution times.
    const runFinish = Date.now();
    const compileTime = elapsedTime(compileBegin, runBegin);
    const runTime = elapsedTime(runBegin, runFinish);
    const totalTime = elapsedTime(allBegin, runFinish);

    sendMessage({
      status: QueryRunStatus.Done,
      resultJson: queryResult.toJSON(),
      dataStyles: {},
      canDownloadStream: !isBrowser,
      defaultTab,
      stats: {
        compileTime,
        runTime,
        totalTime,
      },
    });
  } catch (error) {
    sendMessage({
      status: QueryRunStatus.Error,
      error: errorMessage(error),
    });
  }
};

function elapsedTime(start: number, end: number): number {
  return (end - start) / 1000;
}

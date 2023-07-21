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
  MalloyQueryData,
  QueryMaterializer,
  Result,
  Runtime,
} from '@malloydata/malloy';
import {MalloySQLParser, MalloySQLSQLStatement} from '@malloydata/malloy-sql';
import {DataStyles} from '@malloydata/render';

import {HackyDataStylesAccumulator} from './data_styles';
import {
  MessageCancel,
  WorkerMessageHandler,
  MessageRun,
} from '../common/worker_message_types';

import {
  QueryMessageStatus,
  QueryPanelMessage,
  QueryRunStatus,
} from '../common/message_types';
import {createModelMaterializer, createRunnable} from './create_runnable';
import {ConnectionManager} from '../common/connection_manager';
import {CellData, FileHandler, StructDefResult} from '../common/types';
import {ProgressType} from 'vscode-jsonrpc';
import {errorMessage} from '../common/errors';

interface QueryEntry {
  panelId: string;
  canceled: boolean;
}

const runningQueries: Record<string, QueryEntry> = {};

const fakeMalloyResult = (
  structDefResult: StructDefResult,
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

const runMSQLCell = async (
  messageHandler: WorkerMessageHandler,
  files: FileHandler,
  connectionManager: ConnectionManager,
  {query, panelId, showSQLOnly}: MessageRun,
  allCells: CellData[],
  currentCell: CellData
) => {
  const sendMessage = (message: QueryPanelMessage) => {
    const progress = new ProgressType<QueryMessageStatus>();
    messageHandler.sendProgress(progress, panelId, message);
  };

  const url = new URL(panelId);
  const connectionLookup = connectionManager.getConnectionLookup(url);

  const runtime = new Runtime(files, connectionLookup);
  const allBegin = Date.now();
  const compileBegin = allBegin;
  sendMessage({
    status: QueryRunStatus.Compiling,
  });

  const modelMaterializer = await createModelMaterializer(
    query,
    runtime,
    allCells
  );

  const parsed = MalloySQLParser.parse(
    // TODO: Fix connection configuration
    // TODO: Fix pegjs parser to not require demark line
    `>>>sql connection:${currentCell.metadata['connection']}\n${currentCell.text}`,
    currentCell.uri
  );

  const statement = parsed.statements[0] as MalloySQLSQLStatement;
  let compiledStatement = statement.text;
  const dialect = 'unknown';

  for (const malloyQuery of statement.embeddedMalloyQueries) {
    const runnable = modelMaterializer.loadQuery(
      `\nquery: ${malloyQuery.query}`
    );
    const generatedSQL = await runnable.getSQL();

    compiledStatement = compiledStatement.replace(
      malloyQuery.text,
      `(${generatedSQL})`
    );
  }

  const dataStyles: DataStyles = {};
  if (runningQueries[panelId].canceled) return;

  messageHandler.log(compiledStatement);

  sendMessage({
    status: QueryRunStatus.Compiled,
    sql: compiledStatement,
    dialect,
    showSQLOnly,
  });

  if (showSQLOnly) {
    delete runningQueries[panelId];
    sendMessage({
      status: QueryRunStatus.EstimatedCost,
      queryCostBytes: undefined,
    });
    return;
  }

  const runBegin = Date.now();
  sendMessage({
    status: QueryRunStatus.Running,
    sql: compiledStatement,
    dialect,
  });

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

  const queryResult = fakeMalloyResult(
    structDefAttempt,
    compiledStatement,
    sqlResults,
    statement.config.connection
  );

  // Calculate execution times.
  const runFinish = Date.now();
  const compileTime = ellapsedTime(compileBegin, runBegin);
  const runTime = ellapsedTime(runBegin, runFinish);
  const totalTime = ellapsedTime(allBegin, runFinish);

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
  messageRun: MessageRun
): Promise<void> => {
  const {query, panelId, showSQLOnly} = messageRun;

  const sendMessage = (message: QueryPanelMessage) => {
    const progress = new ProgressType<QueryMessageStatus>();
    messageHandler.sendProgress(progress, panelId, message);
  };

  const files = new HackyDataStylesAccumulator(fileHandler);
  const url = new URL(panelId);
  const connectionLookup = connectionManager.getConnectionLookup(url);

  try {
    runningQueries[panelId] = {panelId, canceled: false};

    const queryFileURL = new URL(query.uri);
    let allCells: CellData[] = [];
    let currentCell: CellData | null = null;
    let isMalloySql = false;

    if (queryFileURL.protocol === 'vscode-notebook-cell:') {
      allCells = await fileHandler.fetchCellData(query.uri);
      currentCell = allCells[allCells.length - 1];
      isMalloySql = currentCell.languageId === 'malloy-sql';
    }

    if (isMalloySql) {
      await runMSQLCell(
        messageHandler,
        fileHandler,
        connectionManager,
        messageRun,
        allCells,
        currentCell
      );
      return;
    }

    const runtime = new Runtime(files, connectionLookup);
    const allBegin = Date.now();
    const compileBegin = allBegin;
    sendMessage({
      status: QueryRunStatus.Compiling,
    });

    let dataStyles: DataStyles = {};
    let sql: string;
    const runnable = await createRunnable(query, runtime, allCells);

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
      if (runningQueries[panelId].canceled) return;
      messageHandler.log(sql);

      sendMessage({
        status: QueryRunStatus.Compiled,
        sql,
        dialect,
        showSQLOnly,
      });

      if (showSQLOnly) {
        delete runningQueries[panelId];
        const estimatedRunStats = await runnable.estimateQueryCost();
        sendMessage({
          status: QueryRunStatus.EstimatedCost,
          queryCostBytes: estimatedRunStats?.queryCostBytes,
        });
        return;
      }

      dataStyles = {...dataStyles, ...files.getHackyAccumulatedDataStyles()};
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
    if (runningQueries[panelId].canceled) return;

    // Calculate execution times.
    const runFinish = Date.now();
    const compileTime = ellapsedTime(compileBegin, runBegin);
    const runTime = ellapsedTime(runBegin, runFinish);
    const totalTime = ellapsedTime(allBegin, runFinish);

    sendMessage({
      status: QueryRunStatus.Done,
      resultJson: queryResult.toJSON(),
      dataStyles,
      canDownloadStream: !isBrowser,
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
  } finally {
    delete runningQueries[panelId];
  }
};

export const cancelQuery = ({panelId}: MessageCancel): void => {
  if (runningQueries[panelId]) {
    runningQueries[panelId].canceled = true;
  }
};

function ellapsedTime(start: number, end: number): number {
  return (end - start) / 1000;
}

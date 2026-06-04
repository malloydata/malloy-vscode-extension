/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  isSourceDef,
  MalloyError,
  MalloyQueryData,
  Result,
  Runtime,
  SerializedExplore,
  StructDef,
} from '@malloydata/malloy';
import {mkModelDef} from '@malloydata/malloy/internal';
import {MalloySQLSQLParser} from '@malloydata/malloy-sql';

import {
  WorkerMessageHandler,
  MessageRun,
} from '../common/types/worker_message_types';

import {
  GivenInfo,
  QueryMessageStatus,
  QueryRunStatus,
} from '../common/types/message_types';
import {createModelMaterializer, createRunnable} from './create_runnable';
import {ConnectionManager} from '../common/types/connection_manager_types';
import {Cell, CellData, FileHandler} from '../common/types/file_handler';
import {CancellationToken, ProgressType} from 'vscode-jsonrpc';
import {errorMessage} from '../common/errors';
import {fixLogRange} from '../common/malloy_sql';
import {idleRuntime} from '../util/idle_runtime';
import {noAwait} from '../util/no_await';

interface StructDefSuccess {
  structDef: StructDef;
  error?: undefined;
}

interface StructDefFailure {
  error: string;
  structDef?: undefined;
}

type StructDefResult = StructDefSuccess | StructDefFailure;

const fakeMalloyResult = (
  {structDef}: StructDefResult,
  sql: string,
  {rows: result, totalRows, runStats, profilingUrl}: MalloyQueryData,
  connectionName: string
): Result => {
  return new Result(
    {
      structs: structDef && isSourceDef(structDef) ? [structDef] : [],
      sql,
      result,
      totalRows,
      profilingUrl,
      lastStageName: sql,
      malloy: '',
      connectionName,
      runStats,
      sourceExplore: '',
      sourceFilters: [],
    },
    mkModelDef('empty_model')
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
  urlReader: FileHandler,
  connectionManager: ConnectionManager,
  {name, query, panelId, showSQLOnly}: MessageRun,
  cellData: CellData | null,
  currentCell: Cell,
  workspaceFolders: string[],
  cancellationToken: CancellationToken
) => {
  const sendMessage = (message: QueryMessageStatus) => {
    const progress = new ProgressType<QueryMessageStatus>();
    console.debug('sendMessage', panelId, message.status);
    noAwait(messageHandler.sendProgress(progress, panelId, message));
  };

  const {
    documentMeta: {uri},
  } = query;
  const url = new URL(uri);
  const config = await connectionManager.getConfigForFile(url);
  const connections = config.connections;
  const runtime = new Runtime({urlReader, config});
  try {
    const allBegin = Date.now();
    const compileBegin = allBegin;
    sendMessage({
      status: QueryRunStatus.Compiling,
    });

    const modelMaterializer = await createModelMaterializer(
      uri,
      runtime,
      cellData,
      workspaceFolders
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
            message += fixLogRange(uri, malloyQuery, log);
          });
          throw new MalloyError(message, e.problems);
        }
        throw e;
      }
    }

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

    const connection = await connections.lookupConnection(connectionName);

    const abortController = new AbortController();
    cancellationToken.onCancellationRequested(() => {
      abortController.abort();
    });

    const sqlResults = await connection.runSQL(compiledStatement, {
      abortSignal: abortController.signal,
    });

    if (cancellationToken.isCancellationRequested) return;

    // rendering is nice if we can do it. try to get a structdef for the last query,
    // and if we get one, return Result object for rendering
    const sql = compiledStatement
      .replaceAll(/^--[^\n]*$/gm, '') // Remove comments
      .replace(/;\s*$/, ''); // Remove trailing `;`
    const structDefAttempt = await connection.fetchSchemaForSQLStruct(
      {
        selectStr: sql,
        connection: connection.name,
      },
      {}
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
      name,
      resultJson: queryResult.toJSON(),
      canDownloadStream: false,
      stats: {
        compileTime,
        runTime,
        totalTime,
      },
    });

    return;
  } finally {
    await idleRuntime(runtime);
  }
};

export const runQuery = async (
  messageHandler: WorkerMessageHandler,
  fileHandler: FileHandler,
  connectionManager: ConnectionManager,
  isBrowser: boolean,
  messageRun: MessageRun,
  cancellationToken: CancellationToken
): Promise<void> => {
  const {
    defaultTab,
    givens,
    name,
    panelId,
    query,
    showSQLOnly,
    showSchemaOnly,
  } = messageRun;

  const sendMessage = (message: QueryMessageStatus) => {
    console.debug('sendMessage', panelId, message.status);
    const progress = new ProgressType<QueryMessageStatus>();
    noAwait(messageHandler.sendProgress(progress, panelId, message));
  };

  const abortController = new AbortController();
  const abortSignal = abortController.signal;
  const {
    documentMeta: {uri},
  } = query;

  try {
    const url = new URL(uri);
    let cellData: CellData | null = null;
    let currentCell: Cell | null = null;
    let isMalloySql = false;

    cancellationToken.onCancellationRequested(() => {
      console.info('Cancelled', panelId);
      abortController.abort('Cancelled');
    });

    if (url.protocol === 'vscode-notebook-cell:') {
      cellData = await fileHandler.fetchCellData(uri);
      currentCell = cellData.cells[cellData.cells.length - 1];
      isMalloySql = currentCell.languageId === 'malloy-sql';
    }

    let workspaceFolders: string[] = [];
    if (url.protocol === 'untitled:') {
      workspaceFolders = await fileHandler.fetchWorkspaceFolders(uri);
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
          workspaceFolders,
          cancellationToken
        );
      } else {
        throw new Error('Unexpected state: Malloy SQL outside of notebook');
      }
      return;
    }

    const config = await connectionManager.getConfigForFile(url);
    const runtime = new Runtime({
      urlReader: fileHandler,
      config,
    });
    try {
      const allBegin = Date.now();
      const compileBegin = allBegin;
      sendMessage({
        status: QueryRunStatus.Compiling,
      });

      const runnable = await createRunnable(
        query,
        runtime,
        cellData,
        workspaceFolders
      );

      if (showSchemaOnly) {
        const modelMaterializer = await createModelMaterializer(
          uri,
          runtime,
          cellData,
          workspaceFolders
        );
        const model = await modelMaterializer?.getModel();
        if (model) {
          if (query.type === 'file' && query.exploreName) {
            sendMessage({
              status: QueryRunStatus.Schema,
              schema: model.explores
                .filter(explore => explore.name === query.exploreName)
                .map(explore => explore.toJSON()),
            });
          } else {
            sendMessage({
              status: QueryRunStatus.Schema,
              schema: model.explores.map(explore => explore.toJSON()),
            });
          }
        }
        return;
      }

      const preparedQuery = await runnable.getPreparedQuery();

      // Sent before compile/run so the editor is reachable when the
      // run itself fails (e.g. a required given with no value).
      const givenInfos: GivenInfo[] = [];
      for (const [givenName, given] of preparedQuery.givens) {
        givenInfos.push({
          name: givenName,
          kind: given.type.type,
          hasDefault: given.default !== undefined,
          currentValue: givens?.[givenName],
        });
      }
      if (givenInfos.length > 0) {
        sendMessage({
          status: QueryRunStatus.Givens,
          panelId,
          givens: givenInfos,
        });
      }

      const preparedResult = await runnable.getPreparedResult({givens});

      // Set the row limit to the limit provided in the final stage of the query, if present
      const rowLimit = preparedResult.resultExplore.limit;
      const dialect = preparedQuery.dialect;

      const sql = preparedResult.sql;
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
        schema.push(preparedResult.resultExplore.toJSON());
        const estimatedRunStats = await runnable.estimateQueryCost();
        sendMessage({
          status: QueryRunStatus.EstimatedCost,
          queryCostBytes: estimatedRunStats?.queryCostBytes,
          schema,
        });
        return;
      }

      const runBegin = Date.now();
      sendMessage({
        status: QueryRunStatus.Running,
        sql,
        dialect,
      });

      const queryResult = await runnable.run({
        rowLimit,
        abortSignal,
        givens,
      });
      if (cancellationToken.isCancellationRequested) return;

      // Calculate execution times.
      const runFinish = Date.now();
      const compileTime = elapsedTime(compileBegin, runBegin);
      const runTime = elapsedTime(runBegin, runFinish);
      const totalTime = elapsedTime(allBegin, runFinish);

      sendMessage({
        name,
        status: QueryRunStatus.Done,
        resultJson: queryResult.toJSON(),
        canDownloadStream: !isBrowser,
        defaultTab,
        profilingUrl: queryResult.profilingUrl,
        stats: {
          compileTime,
          runTime,
          totalTime,
        },
      });
    } finally {
      await idleRuntime(runtime);
    }
  } catch (error) {
    if (cancellationToken.isCancellationRequested) {
      console.info('Cancelled request generated error', error);
    } else {
      sendMessage({
        status: QueryRunStatus.Error,
        error: errorMessage(error),
      });
    }
  }
};

function elapsedTime(start: number, end: number): number {
  return (end - start) / 1000;
}

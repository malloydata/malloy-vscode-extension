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

import {QueryMaterializer, Runtime} from '@malloydata/malloy';
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
import {createRunnable} from './create_runnable';
import {ConnectionManager} from '../common/connection_manager';
import {FileHandler} from '../common/types';
import {ProgressType} from 'vscode-jsonrpc';
import {errorMessage} from '../common/errors';

interface QueryEntry {
  panelId: string;
  canceled: boolean;
}

const runningQueries: Record<string, QueryEntry> = {};

export const runQuery = async (
  messageHandler: WorkerMessageHandler,
  fileHandler: FileHandler,
  connectionManager: ConnectionManager,
  isBrowser: boolean,
  {query, panelId, showSQLOnly}: MessageRun
): Promise<void> => {
  const sendMessage = (message: QueryPanelMessage) => {
    const progress = new ProgressType<QueryMessageStatus>();

    messageHandler.sendProgress(progress, panelId, message);
  };

  const files = new HackyDataStylesAccumulator(fileHandler);
  const url = new URL(panelId);

  try {
    const runtime = new Runtime(
      files,
      connectionManager.getConnectionLookup(url)
    );

    runningQueries[panelId] = {panelId, canceled: false};

    const allBegin = Date.now();
    const compileBegin = allBegin;
    sendMessage({
      status: QueryRunStatus.Compiling,
    });

    let dataStyles: DataStyles = {};
    let sql: string;
    const runnable = await createRunnable(query, runtime, fileHandler);

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

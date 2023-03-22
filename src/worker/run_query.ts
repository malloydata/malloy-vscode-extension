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

import {QueryMaterializer, Runtime, URLReader} from '@malloydata/malloy';
import {DataStyles} from '@malloydata/render';

import {HackyDataStylesAccumulator} from './data_styles';
import {log} from './logger';
import {
  MessageCancel,
  MessageHandler,
  MessageRun,
  WorkerQueryPanelMessage,
} from '../common/worker_message_types';

import {
  QueryMessageType,
  QueryPanelMessage,
  QueryRunStatus,
} from '../common/message_types';
import {createRunnable} from './create_runnable';
import {ConnectionManager} from '../common/connection_manager';
import {CellData} from '../common/types';

interface QueryEntry {
  panelId: string;
  canceled: boolean;
}

const runningQueries: Record<string, QueryEntry> = {};

const sendMessage = (
  messageHandler: MessageHandler,
  message: QueryPanelMessage,
  panelId: string
) => {
  const msg: WorkerQueryPanelMessage = {
    type: 'query_panel',
    panelId,
    message,
  };

  messageHandler.send(msg);
};

export const runQuery = async (
  messageHandler: MessageHandler,
  reader: URLReader,
  connectionManager: ConnectionManager,
  isBrowser: boolean,
  {query, panelId}: MessageRun,
  fetchCellData: (uri: string) => Promise<CellData[]>
): Promise<void> => {
  const files = new HackyDataStylesAccumulator(reader);
  const url = new URL(panelId);

  try {
    const runtime = new Runtime(
      files,
      connectionManager.getConnectionLookup(url)
    );

    runningQueries[panelId] = {panelId, canceled: false};
    sendMessage(
      messageHandler,
      {
        type: QueryMessageType.QueryStatus,
        status: QueryRunStatus.Compiling,
      },
      panelId
    );

    let dataStyles: DataStyles = {};
    let sql;
    const runnable = await createRunnable(query, runtime, fetchCellData);

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
      dataStyles = {...dataStyles, ...files.getHackyAccumulatedDataStyles()};

      if (runningQueries[panelId].canceled) return;
      log(sql);
    } catch (error) {
      sendMessage(
        messageHandler,
        {
          type: QueryMessageType.QueryStatus,
          status: QueryRunStatus.Error,
          error: error.message || 'Something went wrong',
        },
        panelId
      );
      return;
    }

    sendMessage(
      messageHandler,
      {
        type: QueryMessageType.QueryStatus,
        status: QueryRunStatus.Running,
        sql,
        dialect,
      },
      panelId
    );
    const queryResult = await runnable.run({rowLimit});
    if (runningQueries[panelId].canceled) return;

    sendMessage(
      messageHandler,
      {
        type: QueryMessageType.QueryStatus,
        status: QueryRunStatus.Done,
        resultJson: queryResult.toJSON(),
        dataStyles,
        canDownloadStream: !isBrowser,
      },
      panelId
    );
  } catch (error) {
    sendMessage(
      messageHandler,
      {
        type: QueryMessageType.QueryStatus,
        status: QueryRunStatus.Error,
        error: error.message,
      },
      panelId
    );
  } finally {
    delete runningQueries[panelId];
  }
};

export const cancelQuery = ({panelId}: MessageCancel): void => {
  if (runningQueries[panelId]) {
    runningQueries[panelId].canceled = true;
  }
};

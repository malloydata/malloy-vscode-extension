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
  WorkerQueryPanelMessage,
} from '../common/worker_message_types';

import {
  QueryMessageType,
  QueryPanelMessage,
  QueryRunStatus,
} from '../common/message_types';
import {ConnectionManager} from '../common/connection_manager';
import {FileHandler} from '../common/types';

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
    type: 'malloy/queryPanel',
    panelId,
    message,
  };

  messageHandler.send(msg);
};

export const runMalloySQLQuery = async (
  messageHandler: MessageHandler,
  connectionManager: ConnectionManager,
  {query, connectionName, panelId}: MessageRunMalloySQL
): Promise<void> => {
  runningQueries[panelId] = {panelId, canceled: false};
  try {
    const lookup = connectionManager.getConnectionLookup(
      new URL(connectionName + ':')
    );
    const connection = await lookup.lookupConnection(connectionName);

    try {
      // sendMessage(
      //   messageHandler,
      //   {
      //     type: QueryMessageType.QueryStatus,
      //     status: QueryRunStatus.Running,
      //     sql,
      //     dialect,
      //   },
      //   panelId
      // );
      const queryResult = await connection.runSQL(query);

      if (runningQueries[panelId].canceled) return;
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

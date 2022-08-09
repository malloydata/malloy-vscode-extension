import { QueryMaterializer, Runtime } from "@malloydata/malloy";
import { DataStyles } from "@malloydata/render";

import { HackyDataStylesAccumulator } from "./data_styles";
import { WorkerURLReader } from "./files";
import { log } from "./logger";
import { MessageCancel, MessageRun } from "./types";

import { CONNECTION_MANAGER } from "../server/connections";
import {
  QueryMessageType,
  QueryPanelMessage,
  QueryRunStatus,
} from "../extension/message_types";
import { WorkerQueryPanelMessage } from "./types";
import { createRunnable } from "./utils";

interface QueryEntry {
  panelId: string;
  canceled: boolean;
}

const runningQueries: Record<string, QueryEntry> = {};

const sendMessage = (message: QueryPanelMessage, panelId: string) => {
  const msg: WorkerQueryPanelMessage = {
    type: "query_panel",
    panelId,
    message,
  };
  log(`Sending: ${JSON.stringify(msg)}`);
  process.send?.(msg);
};

export const runQuery = async ({
  query,
  panelId,
}: MessageRun): Promise<void> => {
  const reader = new WorkerURLReader();
  const files = new HackyDataStylesAccumulator(reader);
  const url = new URL(panelId);

  try {
    const runtime = new Runtime(
      files,
      CONNECTION_MANAGER.getConnectionLookup(url)
    );

    runningQueries[panelId] = { panelId, canceled: false };
    sendMessage(
      {
        type: QueryMessageType.QueryStatus,
        status: QueryRunStatus.Compiling,
      },
      panelId
    );

    let styles: DataStyles = {};
    const runnable = createRunnable(query, runtime);

    // Set the row limit to the limit provided in the final stage of the query, if present
    const rowLimit =
      runnable instanceof QueryMaterializer
        ? (await runnable.getPreparedResult()).resultExplore.limit
        : undefined;

    try {
      const sql = await runnable.getSQL();
      styles = { ...styles, ...files.getHackyAccumulatedDataStyles() };

      if (runningQueries[panelId].canceled) return;
      log(sql);
    } catch (error) {
      sendMessage(
        {
          type: QueryMessageType.QueryStatus,
          status: QueryRunStatus.Error,
          error: error.message || "Something went wrong",
        },
        panelId
      );
      return;
    }

    sendMessage(
      {
        type: QueryMessageType.QueryStatus,
        status: QueryRunStatus.Running,
      },
      panelId
    );
    const queryResult = await runnable.run({ rowLimit });
    if (runningQueries[panelId].canceled) return;

    sendMessage(
      {
        type: QueryMessageType.QueryStatus,
        status: QueryRunStatus.Done,
        result: queryResult.toJSON(),
        styles,
      },
      panelId
    );
  } catch (error) {
    sendMessage(
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

export const cancelQuery = ({ panelId }: MessageCancel): void => {
  if (runningQueries[panelId]) {
    runningQueries[panelId].canceled = true;
  }
};

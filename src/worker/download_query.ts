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

import * as fs from "fs";
import { fileURLToPath } from "url";

import { CSVWriter, JSONWriter, Runtime } from "@malloydata/malloy";

import { MessageDownload, WorkerDownloadMessage } from "./types";
import { createRunnable } from "./utils";
import { WorkerURLReader } from "./node/files";
import { ConnectionManager } from "../common/connection_manager";

const sendMessage = (name: string, error?: string) => {
  const msg: WorkerDownloadMessage = {
    type: "download",
    name,
    error,
  };
  process.send?.(msg);
};

export async function downloadQuery(
  connectionManager: ConnectionManager,
  { query, panelId, downloadOptions, name, uri }: MessageDownload
): Promise<void> {
  const files = new WorkerURLReader();
  const url = new URL(panelId);

  try {
    const runtime = new Runtime(
      files,
      connectionManager.getConnectionLookup(url)
    );

    const runnable = createRunnable(query, runtime);
    const writeStream = fs.createWriteStream(fileURLToPath(uri));
    const writer =
      downloadOptions.format === "json"
        ? new JSONWriter(writeStream)
        : new CSVWriter(writeStream);
    const rowLimit =
      typeof downloadOptions.amount === "number"
        ? downloadOptions.amount
        : undefined;
    const rowStream = runnable.runStream({
      rowLimit,
    });
    await writer.process(rowStream);
    sendMessage(name);
  } catch (error) {
    sendMessage(name, error.message);
  }
}

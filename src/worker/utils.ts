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
  QueryMaterializer,
  Runtime,
  SQLBlockMaterializer,
} from "@malloydata/malloy";
import { WorkerQuerySpec } from "./types";

export const createRunnable = (
  query: WorkerQuerySpec,
  runtime: Runtime
): SQLBlockMaterializer | QueryMaterializer => {
  let runnable: QueryMaterializer | SQLBlockMaterializer;
  const queryFileURL = new URL("file://" + query.file);
  if (query.type === "string") {
    runnable = runtime.loadModel(queryFileURL).loadQuery(query.text);
  } else if (query.type === "named") {
    runnable = runtime.loadQueryByName(queryFileURL, query.name);
  } else if (query.type === "file") {
    if (query.index === -1) {
      runnable = runtime.loadQuery(queryFileURL);
    } else {
      runnable = runtime.loadQueryByIndex(queryFileURL, query.index);
    }
  } else if (query.type === "named_sql") {
    runnable = runtime.loadSQLBlockByName(queryFileURL, query.name);
  } else if (query.type === "unnamed_sql") {
    runnable = runtime.loadSQLBlockByIndex(queryFileURL, query.index);
  } else {
    throw new Error("Internal Error: Unexpected query type");
  }
  return runnable;
};

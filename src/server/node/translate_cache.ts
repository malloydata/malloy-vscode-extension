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
import { TextDocuments } from "vscode-languageserver/node";
import { Model, Runtime } from "@malloydata/malloy";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ConnectionManager } from "../../common/connection_manager";
import { TranslateCache } from "../types";
import { fileURLToPath } from "url";

export class TranslateCacheNode implements TranslateCache {
  cache = new Map<string, { model: Model; version: number }>();

  async getDocumentText(
    documents: TextDocuments<TextDocument>,
    uri: URL
  ): Promise<string> {
    const cached = documents.get(uri.toString());
    if (cached) {
      return cached.getText();
    } else {
      // TODO catch a file read error
      return fs.readFileSync(fileURLToPath(uri), "utf-8");
    }
  }

  async translateWithCache(
    connectionManager: ConnectionManager,
    document: TextDocument,
    documents: TextDocuments<TextDocument>
  ): Promise<Model> {
    const currentVersion = document.version;
    const uri = document.uri;

    const entry = this.cache.get(uri);
    if (entry && entry.version === currentVersion) {
      return entry.model;
    }

    const files = {
      readURL: (url: URL) => this.getDocumentText(documents, url),
    };
    const runtime = new Runtime(
      files,
      connectionManager.getConnectionLookup(new URL(document.uri))
    );

    const model = await runtime.getModel(new URL(uri));
    this.cache.set(uri, { version: currentVersion, model });
    return model;
  }
}

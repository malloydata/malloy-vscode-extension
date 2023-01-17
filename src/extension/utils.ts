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

import { fileURLToPath } from "node:url";
import { URLReader } from "@malloydata/malloy";
import * as vscode from "vscode";
import { randomInt } from "crypto";
import { promises as fs } from "fs";

export async function fetchFile(path: string): Promise<string> {
  const openFiles = vscode.workspace.textDocuments;
  const openDocument = openFiles.find(
    (document) => document.uri.fsPath === path
  );
  // Only get the text from VSCode's open files if the file is alredy open in VSCode,
  // otherwise, just read the file from the file system
  if (openDocument !== undefined) {
    return openDocument.getText();
  } else {
    return fs.readFile(path, "utf-8");
  }
}

export class VSCodeURLReader implements URLReader {
  async readURL(url: URL): Promise<string> {
    switch (url.protocol) {
      case "file:":
        return fetchFile(fileURLToPath(url));
      default:
        throw new Error(
          `Protocol ${url.protocol} not implemented in VSCodeURLReader.`
        );
    }
  }
}

const CLIENT_ID_CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomClientIdCharacter() {
  return CLIENT_ID_CHARACTERS.charAt(
    Math.floor(randomInt(0, CLIENT_ID_CHARACTERS.length))
  );
}

export function getNewClientId(): string {
  return Array.from({ length: 32 }, randomClientIdCharacter).join("");
}

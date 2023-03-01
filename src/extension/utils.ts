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
/* eslint-disable no-console */

import {URLReader} from '@malloydata/malloy';
import * as vscode from 'vscode';

const fixNotebookUri = (uri: vscode.Uri) => {
  if (uri.scheme === 'vscode-notebook-cell') {
    uri = vscode.Uri.from({
      scheme: 'file',
      authority: uri.authority,
      path: uri.path,
      query: uri.query,
    });
  }

  return uri;
};

export async function fetchFile(uri: string): Promise<string> {
  const openFiles = vscode.workspace.textDocuments;
  const openDocument = openFiles.find(
    document => document.uri.toString() === uri
  );
  // Only get the text from VSCode's open files if the file is already open in VSCode,
  // otherwise, just read the file from the file system
  if (openDocument !== undefined) {
    return openDocument.getText();
  } else {
    const contents = await vscode.workspace.fs.readFile(vscode.Uri.parse(uri));
    return new TextDecoder('utf-8').decode(contents);
  }
}

export async function fetchBinaryFile(
  uriString: string
): Promise<Uint8Array | undefined> {
  const uri = fixNotebookUri(vscode.Uri.parse(uriString));
  try {
    return await vscode.workspace.fs.readFile(uri);
  } catch (error) {
    console.error(error);
  }
  return undefined;
}

export class VSCodeURLReader implements URLReader {
  async readURL(url: URL): Promise<string> {
    return fetchFile(url.toString());
  }
}

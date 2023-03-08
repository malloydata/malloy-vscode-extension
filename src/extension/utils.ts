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
import {CellData} from './types';
/**
 * Transforms vscode-notebook-cell: Uris to file: or vscode-vfs: URLS
 * based on the workspace, because VS Code can't use a vscode-notebook-cell:
 * as a relative url for non-cells, like external Malloy files.
 *
 * @param uri Document uri
 * @returns Uri with an appropriate protocol
 */
const fixNotebookUri = (uri: vscode.Uri) => {
  if (uri.scheme === 'vscode-notebook-cell') {
    const {scheme} = vscode.workspace.workspaceFolders[0].uri;
    uri = vscode.Uri.from({
      scheme,
      authority: uri.authority,
      path: uri.path,
      query: uri.query,
    });
  }

  return uri;
};

/**
 * Fetches the text contents of a Uri for the Malloy compiler. For most Uri
 * types this means either from the open file cache, or from VS Code's
 * file system.
 *
 *
 * @param uriString Uri to fetch
 * @returns Text contents for Uri
 */
export async function fetchFile(uriString: string): Promise<string> {
  const uri = vscode.Uri.parse(uriString);
  const openFiles = vscode.workspace.textDocuments;

  const openDocument = openFiles.find(
    document => document.uri.toString() === uriString
  );
  // Only get the text from VSCode's open files if the file is already open in VSCode,
  // otherwise, just read the file from the file system
  if (openDocument !== undefined) {
    return openDocument.getText();
  } else {
    const contents = await vscode.workspace.fs.readFile(fixNotebookUri(uri));
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

export async function fetchCellData(uriString: string): Promise<CellData[]> {
  const uri = vscode.Uri.parse(uriString);
  const notebook = vscode.workspace.notebookDocuments.find(
    notebook => notebook.uri.path === uri.path
  );
  const result: CellData[] = [];
  if (notebook) {
    for (const cell of notebook.getCells()) {
      if (cell.kind === vscode.NotebookCellKind.Code) {
        result.push({
          uri: cell.document.uri.toString(),
          text: cell.document.getText(),
        });
      }
      if (cell.document.uri.fragment === uri.fragment) {
        break;
      }
    }
  }
  return result;
}

export class VSCodeURLReader implements URLReader {
  async readURL(url: URL): Promise<string> {
    return fetchFile(url.toString());
  }
}

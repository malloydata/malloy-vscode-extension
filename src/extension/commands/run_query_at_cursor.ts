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

import * as vscode from 'vscode';
import {MALLOY_EXTENSION_STATE} from '../state';
import {ResultJSON} from '@malloydata/malloy';
import {BaseLanguageClient, CodeLens} from 'vscode-languageclient';

export async function runQueryAtCursorCommand(
  client: BaseLanguageClient
): Promise<ResultJSON | undefined> {
  const document =
    vscode.window.activeTextEditor?.document ||
    MALLOY_EXTENSION_STATE.getActiveWebviewPanel()?.document;
  if (document) {
    const lenses: CodeLens[] = await client.sendRequest('malloy/findLensesAt', {
      uri: document.uri.toString(),
      position: MALLOY_EXTENSION_STATE.getActivePosition(),
    });
    // Not sure if this is the most accurate approach, but pick the most nested
    // lens to execute.
    const deepest = lenses.reduce<CodeLens | null>((deepest, current) => {
      if (
        [
          'malloy.runQuery',
          'malloy.runQueryFile',
          'malloy.runNamedQuery',
          'malloy.runNamedSQLBlock',
          'malloy.runUnnamedSQLBlock',
        ].includes(current.command?.command || '')
      ) {
        if (deepest) {
          if (current.range.start.character > deepest.range.start.character) {
            deepest = current;
          }
        } else {
          deepest = current;
        }
      }
      return deepest;
    }, null);
    if (deepest?.command?.arguments) {
      return await vscode.commands.executeCommand(
        deepest.command.command,
        ...deepest.command.arguments
      );
    }
  }

  return undefined;
}

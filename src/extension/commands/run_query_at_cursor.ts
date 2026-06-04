/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import {MALLOY_EXTENSION_STATE} from '../state';
import {BaseLanguageClient, CodeLens} from 'vscode-languageclient';
import {RunMalloyQueryResult} from '../../common/types/message_types';

export async function runQueryAtCursorCommand(
  client: BaseLanguageClient
): Promise<RunMalloyQueryResult | undefined> {
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

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import {prettify} from '@malloydata/malloy/internal';
import {malloyLog} from './logger';

export interface OffsetEdit {
  start: number;
  end: number;
  newText: string;
}

class MalloyFormatter implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(
    document: vscode.TextDocument
  ): vscode.TextEdit[] {
    const original = document.getText();
    const {result, errors} = prettify(original);
    if (errors.length > 0) {
      const uri = document.uri.toString();
      malloyLog.appendLine(
        `Skipped formatting ${uri} — ${errors.length} parse error(s)`
      );
      return [];
    }
    const edit = minimalEdit(original, result);
    if (edit === null) {
      return [];
    }
    const range = new vscode.Range(
      document.positionAt(edit.start),
      document.positionAt(edit.end)
    );
    return [vscode.TextEdit.replace(range, edit.newText)];
  }
}

/**
 * Compute a single replacement that turns `original` into `formatted`,
 * trimming any common prefix and suffix so the edit covers only the
 * changed slice. Returns null if the strings are identical.
 */
export function minimalEdit(
  original: string,
  formatted: string
): OffsetEdit | null {
  if (original === formatted) {
    return null;
  }
  const max = Math.min(original.length, formatted.length);
  let prefix = 0;
  while (prefix < max && original[prefix] === formatted[prefix]) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < max - prefix &&
    original[original.length - 1 - suffix] ===
      formatted[formatted.length - 1 - suffix]
  ) {
    suffix++;
  }
  return {
    start: prefix,
    end: original.length - suffix,
    newText: formatted.slice(prefix, formatted.length - suffix),
  };
}

export function registerMalloyFormatter(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      {language: 'malloy'},
      new MalloyFormatter()
    )
  );
}

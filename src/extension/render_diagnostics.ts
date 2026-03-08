/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import type * as Malloy from '@malloydata/malloy-interfaces';

const collection = vscode.languages.createDiagnosticCollection('malloy-render');

const panelDiagnosticUris = new Map<string, vscode.Uri[]>();

export function setRenderDiagnostics(
  panelId: string,
  logs: Malloy.LogMessage[],
  fallbackUri: string,
  fallbackLine: number
) {
  clearRenderDiagnostics(panelId);

  const byUri = new Map<string, vscode.Diagnostic[]>();

  for (const log of logs) {
    const uri = log.url || fallbackUri;
    if (!byUri.has(uri)) {
      byUri.set(uri, []);
    }

    const severity =
      log.severity === 'warn'
        ? vscode.DiagnosticSeverity.Warning
        : log.severity === 'info' || log.severity === 'debug'
        ? vscode.DiagnosticSeverity.Information
        : vscode.DiagnosticSeverity.Error;

    const hasLocation =
      log.url && (log.range.start.line > 0 || log.range.start.character > 0);
    const range = hasLocation
      ? new vscode.Range(
          log.range.start.line,
          log.range.start.character,
          log.range.end.line,
          log.range.end.character
        )
      : new vscode.Range(fallbackLine, 0, fallbackLine, 0);

    const diagnostic = new vscode.Diagnostic(range, log.message, severity);
    diagnostic.source = 'malloy-render';
    byUri.get(uri)!.push(diagnostic);
  }

  const uris: vscode.Uri[] = [];
  for (const [uri, diagnostics] of byUri) {
    const vscodeUri = vscode.Uri.parse(uri);
    collection.set(vscodeUri, diagnostics);
    uris.push(vscodeUri);
  }
  panelDiagnosticUris.set(panelId, uris);
}

export function clearRenderDiagnostics(panelId: string) {
  const uris = panelDiagnosticUris.get(panelId);
  if (uris) {
    for (const uri of uris) {
      collection.delete(uri);
    }
    panelDiagnosticUris.delete(panelId);
  }
}

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// For Thenable
import 'vscode-jsonrpc';

export function noAwait(x: Thenable<unknown>) {
  // Avoid unhandled exceptions
  x.then(() => {}, console.error);
}

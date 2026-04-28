/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Connection} from '@malloydata/malloy';

export interface ConnectionFactory {
  postProcessConnection?(conn: Connection, workingDir: string): void;

  /**
   * Default connections (name → registered type) this host wants to expose.
   * When implemented, this is **authoritative**: the manager uses exactly
   * this list for the sidebar and pre-seeds the level-3 runtime config with
   * matching `{is: type}` entries, so `lookupConnection(name)` resolves to
   * `type`. Used for environments where a registered type should be
   * presented under a friendlier name — notably the browser, which
   * registers `duckdb_wasm` but advertises it as `duckdb`.
   *
   * When not implemented, the manager falls back to the registry-derived
   * default list (one entry per registered type plus the `md → duckdb`
   * alias), and relies on malloy core's `includeDefaultConnections: true`
   * to fabricate matching connections at runtime.
   */
  getDefaultConnections?(): Record<string, string>;
}

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {GivenValue} from '@malloydata/malloy';
import {
  getPanelRerunState,
  runMalloyQueryWithProgress,
} from './utils/run_query_utils';

/**
 * Re-run the query in an existing result panel with a fresh givens map.
 * Triggered by the Givens editor's "Run" button via the webview's
 * `RunCommand` channel.
 */
export function rerunWithGivensCommand(
  panelId: string,
  givens: Record<string, GivenValue>
): void {
  const state = getPanelRerunState(panelId);
  if (!state) {
    return;
  }
  const {context, worker, query, name, options} = state;
  void runMalloyQueryWithProgress(context, worker, query, panelId, name, {
    ...options,
    givens,
  });
}

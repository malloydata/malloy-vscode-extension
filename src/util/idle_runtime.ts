/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Runtime} from '@malloydata/malloy';

/**
 * Idle a runtime's connections, swallowing any error.
 *
 * Used in `finally` blocks around per-operation Runtime use so that a
 * shutdown failure cannot mask the operation's result or original error.
 */
export async function idleRuntime(runtime: Runtime): Promise<void> {
  try {
    await runtime.shutdown('idle');
  } catch (err) {
    console.warn('Error idling runtime connections:', err);
  }
}

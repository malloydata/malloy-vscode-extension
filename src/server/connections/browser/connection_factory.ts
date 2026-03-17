/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/db-duckdb/browser';
import {ConnectionFactory} from '../../../common/connections/types';

export class WebConnectionFactory implements ConnectionFactory {
  reset() {
    // No-op: connections are now created fresh per-operation via the registry.
  }

  getWorkingDirectory(url: URL): string {
    try {
      const baseUrl = new URL('.', url);
      return baseUrl.toString();
    } catch {
      return url.toString();
    }
  }
}

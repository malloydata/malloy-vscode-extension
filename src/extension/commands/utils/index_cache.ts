/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {RunMalloyQueryResult} from '../../../common/types/message_types';

class IndexCache {
  private cache: Map<string, RunMalloyQueryResult>;

  constructor() {
    this.cache = new Map<string, RunMalloyQueryResult>();
  }

  get(key: string): RunMalloyQueryResult | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: RunMalloyQueryResult): void {
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
}

export const indexCache = new IndexCache();

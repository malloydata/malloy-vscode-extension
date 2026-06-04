/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {InvalidationKey} from '@malloydata/malloy';

export const logPrefix = (level: string) => {
  const stamp = new Date().toLocaleTimeString();
  return `[${level} - ${stamp}]`;
};

const CELL_HASH = /^W(\d+)s(.*)$/;

export const prettyLogUri = (uri: string): string => {
  const [base, hash] = uri.split('#');

  let pretty = base.split('/').pop() || '';
  if (hash) {
    const match = CELL_HASH.exec(hash);
    if (match) {
      pretty += `:${match[1]}`;
    }
  }
  return pretty;
};

export const prettyLogInvalidationKey = (
  invalidationKey: InvalidationKey
): string => {
  return `v(${`${invalidationKey}`.substring(0, 8)})`;
};

export const prettyTime = (ms: number): string => {
  return (ms / 1000).toFixed(3) + 's';
};

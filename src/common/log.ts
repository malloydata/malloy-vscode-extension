/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {InvalidationKey} from "@malloydata/malloy";

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

export const prettyLogInvalidationKey = (invalidationKey: InvalidationKey): string => {
  return `v(${`${invalidationKey}`.substring(0, 8)})`;
}

export const prettyTime = (ms: number): string => {
  return (ms / 1000).toFixed(3) + "s";
}

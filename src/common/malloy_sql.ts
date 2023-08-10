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

import {LogMessage} from '@malloydata/malloy';
import {EmbeddedMalloyQuery} from '@malloydata/malloy-sql/dist/types';

export const fixLogRange = (
  uri: string,
  malloyQuery: EmbeddedMalloyQuery,
  log: LogMessage,
  adjustment = 0
): string => {
  if (log.at) {
    if (log.at.url === 'internal://internal.malloy') {
      log.at.url = uri;
    } else if (log.at.url !== uri) {
      return '';
    }

    const embeddedStart: number = log.at.range.start.line + adjustment;
    // if the embedded malloy is on the same line as SQL, pad character start (and maybe end)
    if (embeddedStart === 0) {
      log.at.range.start.character += malloyQuery.malloyRange.start.character;
      if (log.at.range.start.line === log.at.range.end.line)
        log.at.range.end.character += malloyQuery.malloyRange.start.character;
    }

    const lineDifference = log.at.range.end.line - log.at.range.start.line;
    log.at.range.start.line = malloyQuery.range.start.line + embeddedStart;
    log.at.range.end.line =
      malloyQuery.range.start.line + embeddedStart + lineDifference;

    return `\n${log.message} at line ${log.at?.range.start.line}`;
  }
  return '';
};

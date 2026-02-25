/*
 * Copyright 2024 Google LLC
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

import {
  ConnectionConfigEntry,
  MalloyConfig,
  TestableConnection,
} from '@malloydata/malloy';

function isTestable(connection: unknown): connection is TestableConnection {
  return (
    typeof connection === 'object' &&
    connection !== null &&
    'test' in connection &&
    typeof (connection as TestableConnection).test === 'function'
  );
}

/**
 * Test a connection using the registry-based format.
 */
export async function testConnectionEntry(
  name: string,
  entry: ConnectionConfigEntry
): Promise<void> {
  const config = new MalloyConfig('{"connections":{}}');
  config.connectionMap = {[name]: entry};
  const lookup = config.connections;
  const connection = await lookup.lookupConnection(name);
  if (!isTestable(connection)) {
    throw new Error(
      `Connection '${name}' (type '${entry.is}') does not support testing`
    );
  }
  await connection.test();
}

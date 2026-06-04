/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
  const config = new MalloyConfig({connections: {[name]: entry}});
  const lookup = config.connections;
  const connection = await lookup.lookupConnection(name);
  if (!isTestable(connection)) {
    throw new Error(
      `Connection '${name}' (type '${entry.is}') does not support testing`
    );
  }
  await connection.test();
}

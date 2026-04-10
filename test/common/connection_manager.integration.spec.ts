/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {CommonConnectionManager} from '../../src/common/connection_manager';
import {ConnectionFactory} from '../../src/common/connections/types';
import {MalloyConfig, URLReader} from '@malloydata/malloy';

// Mock discoverConfig so we can control what it returns
let mockDiscoverResult: MalloyConfig | null = null;

jest.mock('@malloydata/malloy', () => {
  const actual = jest.requireActual('@malloydata/malloy');
  return {
    ...actual,
    discoverConfig: jest.fn(async () => mockDiscoverResult),
  };
});

function makeMockURLReader(): URLReader {
  return {
    readURL: jest.fn(async () => {
      throw new Error('File not found');
    }),
  };
}

describe('CommonConnectionManager integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDiscoverResult = null;
  });

  it('returns a MalloyConfig with connections at level 3 (defaults)', async () => {
    const factory: ConnectionFactory = {};
    const manager = new CommonConnectionManager(factory);
    manager.setURLReader(makeMockURLReader());
    manager.setWorkspaceRoots(['file:///project/']);

    const config = await manager.getConfigForFile(
      new URL('file:///project/test.malloy')
    );
    expect(config).toBeDefined();
    expect(config.connections).toBeDefined();
  });

  it('getConnectionLookup returns the same lookup as getConfigForFile().connections', async () => {
    const factory: ConnectionFactory = {};
    const manager = new CommonConnectionManager(factory);
    manager.setURLReader(makeMockURLReader());
    manager.setWorkspaceRoots(['file:///project/']);

    const url = new URL('file:///project/test.malloy');
    const config = await manager.getConfigForFile(url);
    const lookup = await manager.getConnectionLookup(url);
    expect(lookup).toBe(config.connections);
  });

  it('caches per workspace folder', async () => {
    const factory: ConnectionFactory = {};
    const manager = new CommonConnectionManager(factory);
    manager.setURLReader(makeMockURLReader());
    manager.setWorkspaceRoots(['file:///project/']);

    const url1 = new URL('file:///project/a.malloy');
    const url2 = new URL('file:///project/sub/b.malloy');
    const config1 = await manager.getConfigForFile(url1);
    const config2 = await manager.getConfigForFile(url2);
    expect(config1).toBe(config2);
  });
});

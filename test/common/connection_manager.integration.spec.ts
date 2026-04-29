/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {CommonConnectionManager} from '../../src/common/connection_manager';
import {ConnectionFactory} from '../../src/common/connections/types';
import {discoverConfig, MalloyConfig, URLReader} from '@malloydata/malloy';

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

  // Wiring guard: the unit test on `notebookCellToFileURL` proves the helper
  // works in isolation, but only this test proves it's actually called from
  // `resolveConfigForFile`. Without it, removing the normalization line would
  // pass every other test and silently re-introduce the cell-URI config bug.
  it('normalizes vscode-notebook-cell URIs before discoverConfig walks', async () => {
    const factory: ConnectionFactory = {};
    const manager = new CommonConnectionManager(factory);
    manager.setURLReader(makeMockURLReader());
    manager.setWorkspaceRoots(['file:///project/']);

    await manager.getConfigForFile(
      new URL('vscode-notebook-cell:/project/notebook.malloynb#W5sZmlsZQ%3D%3D')
    );

    expect(discoverConfig).toHaveBeenCalled();
    const [startURL] = jest.mocked(discoverConfig).mock.calls[0];
    expect(startURL.protocol).toBe('file:');
    expect(startURL.hash).toBe('');
    expect(startURL.pathname).toBe('/project/notebook.malloynb');
  });
});

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  CommonConnectionManager,
  isSecretKeyReference,
} from '../../src/common/connection_manager';
import {ConnectionFactory} from '../../src/common/connections/types';
import {
  LookupConnection,
  Connection,
  MalloyConfig,
  URLReader,
} from '@malloydata/malloy';

// --- Mock discoverConfig ---
let mockDiscoverResult: MalloyConfig | null = null;
let discoverCalledWith: {startURL: URL; ceilingURL: URL}[] = [];

jest.mock('@malloydata/malloy', () => {
  const actual = jest.requireActual('@malloydata/malloy');
  return {
    ...actual,
    discoverConfig: jest.fn(
      async (startURL: URL, ceilingURL: URL, _urlReader: URLReader) => {
        discoverCalledWith.push({startURL, ceilingURL});
        return mockDiscoverResult;
      }
    ),
  };
});

function makeMockConfig(overrides?: {
  connections?: LookupConnection<Connection>;
  configURL?: string;
}): MalloyConfig {
  const mockConn = {name: 'mock'} as unknown as Connection;
  const connections = overrides?.connections ?? {
    lookupConnection: jest.fn(async () => mockConn),
  };
  const overlayData: Record<string, Record<string, string>> = {};
  if (overrides?.configURL) {
    overlayData['config'] = {configURL: overrides.configURL};
  }
  let _connections = connections;
  return {
    get connections() {
      return _connections;
    },
    wrapConnections(
      wrapper: (
        base: LookupConnection<Connection>
      ) => LookupConnection<Connection>
    ) {
      _connections = wrapper(_connections);
    },
    releaseConnections: jest.fn(async () => {}),
    readOverlay(name: string, ...path: string[]): unknown {
      let current: unknown = overlayData[name];
      for (const key of path) {
        if (typeof current !== 'object' || current === null) return undefined;
        current = (current as Record<string, unknown>)[key];
      }
      return current;
    },
    log: [],
  } as unknown as MalloyConfig;
}

function makeMockFactory(): ConnectionFactory {
  return {};
}

function makePostProcessFactory(): ConnectionFactory & {
  postProcessCalls: Array<{conn: Connection; workingDir: string}>;
} {
  const calls: Array<{conn: Connection; workingDir: string}> = [];
  return {
    postProcessConnection(conn: Connection, workingDir: string) {
      calls.push({conn, workingDir});
    },
    postProcessCalls: calls,
  };
}

function makeMockURLReader(files: Record<string, string> = {}): URLReader {
  return {
    readURL: jest.fn(async (url: URL) => {
      const key = url.toString();
      if (key in files) return files[key];
      throw new Error(`File not found: ${key}`);
    }),
  };
}

describe('CommonConnectionManager', () => {
  beforeEach(() => {
    mockDiscoverResult = null;
    discoverCalledWith = [];
    // Restore the default mock implementation (clearAllMocks wipes it)
    const {discoverConfig: mockedDiscover} =
      jest.requireMock('@malloydata/malloy');
    (mockedDiscover as jest.Mock).mockImplementation(
      async (startURL: URL, ceilingURL: URL) => {
        discoverCalledWith.push({startURL, ceilingURL});
        return mockDiscoverResult;
      }
    );
  });

  describe('three-level resolution', () => {
    it('level 1: uses discovered config when available', async () => {
      const mockConfig = makeMockConfig();
      mockDiscoverResult = mockConfig;

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);

      const config = await manager.getConfigForFile(
        new URL('file:///project/test.malloy')
      );
      expect(config).toBe(mockConfig);
      expect(discoverCalledWith).toHaveLength(1);
      expect(discoverCalledWith[0].startURL.toString()).toBe(
        'file:///project/test.malloy'
      );
    });

    it('level 2: uses global config when no project config found', async () => {
      mockDiscoverResult = null;

      const globalConfigUrl =
        'file:///home/user/.config/malloy/malloy-config.json';
      const globalConfigText = JSON.stringify({
        connections: {mydb: {is: 'duckdb'}},
      });

      const manager = new CommonConnectionManager(makeMockFactory(), {
        expandHome: (p: string) => p.replace(/^~/, '/home/user'),
      });
      manager.setURLReader(
        makeMockURLReader({[globalConfigUrl]: globalConfigText})
      );
      manager.setWorkspaceRoots(['file:///project/']);
      manager.setGlobalConfigDirectory('~/.config/malloy');

      const config = await manager.getConfigForFile(
        new URL('file:///project/test.malloy')
      );
      // Should have a MalloyConfig (not the discovered one, which is null)
      expect(config).toBeDefined();
      expect(config).not.toBe(mockDiscoverResult);
    });

    it('level 3: falls back to defaults when no config files found', async () => {
      mockDiscoverResult = null;

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);

      const config = await manager.getConfigForFile(
        new URL('file:///project/test.malloy')
      );
      // Should return a MalloyConfig with includeDefaultConnections
      expect(config).toBeDefined();
    });

    it('level 1 takes priority over level 2', async () => {
      const discoveredConfig = makeMockConfig();
      mockDiscoverResult = discoveredConfig;

      const manager = new CommonConnectionManager(makeMockFactory(), {
        expandHome: (p: string) => p.replace(/^~/, '/home/user'),
      });
      manager.setURLReader(
        makeMockURLReader({
          'file:///home/user/.config/malloy/malloy-config.json':
            '{"connections":{}}',
        })
      );
      manager.setWorkspaceRoots(['file:///project/']);
      manager.setGlobalConfigDirectory('~/.config/malloy');

      const config = await manager.getConfigForFile(
        new URL('file:///project/test.malloy')
      );
      // Should use the discovered config, not the global one
      expect(config).toBe(discoveredConfig);
    });
  });

  describe('caching', () => {
    it('caches config per workspace folder', async () => {
      const mockConfig = makeMockConfig();
      mockDiscoverResult = mockConfig;

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);

      const config1 = await manager.getConfigForFile(
        new URL('file:///project/a.malloy')
      );
      const config2 = await manager.getConfigForFile(
        new URL('file:///project/sub/b.malloy')
      );
      // Same discovered config identity → same config (cached)
      expect(config1).toBe(config2);
      // discoverConfig called twice (different directories), but both
      // resolve to the same cached MalloyConfig via identity key
      expect(discoverCalledWith).toHaveLength(2);
    });

    it('nested configs in the same workspace get separate cache entries', async () => {
      // Two config files at different levels: root and sub/
      // Give them distinct configURLs so the cache keys differ
      const rootConfig = makeMockConfig({
        configURL: 'file:///project/malloy-config.json',
      });
      const subConfig = makeMockConfig({
        configURL: 'file:///project/sub/malloy-config.json',
      });
      const {discoverConfig: mockedDiscover} =
        jest.requireMock('@malloydata/malloy');
      (mockedDiscover as jest.Mock).mockImplementation(
        async (startURL: URL, ceilingURL: URL) => {
          discoverCalledWith.push({startURL, ceilingURL});
          // Files under sub/ discover subConfig; others discover rootConfig
          if (startURL.toString().includes('/sub/')) {
            return subConfig;
          }
          return rootConfig;
        }
      );

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);

      const configRoot = await manager.getConfigForFile(
        new URL('file:///project/query.malloy')
      );
      const configSub = await manager.getConfigForFile(
        new URL('file:///project/sub/query.malloy')
      );

      // Different configs because they discovered different config files
      expect(configRoot).not.toBe(configSub);
    });

    it('invalidateCache clears the cache', async () => {
      const mockConfig = makeMockConfig();
      mockDiscoverResult = mockConfig;

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);

      await manager.getConfigForFile(new URL('file:///project/a.malloy'));
      expect(discoverCalledWith).toHaveLength(1);

      manager.notifyConfigFileChanged();

      const newConfig = makeMockConfig();
      mockDiscoverResult = newConfig;
      await manager.getConfigForFile(new URL('file:///project/a.malloy'));
      expect(discoverCalledWith).toHaveLength(2);
    });

    it('calls releaseConnections on invalidation', async () => {
      const mockConfig = makeMockConfig();
      mockDiscoverResult = mockConfig;

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);

      await manager.getConfigForFile(new URL('file:///project/a.malloy'));
      manager.notifyConfigFileChanged();

      expect(mockConfig.releaseConnections).toHaveBeenCalled();
    });
  });

  describe('workspace folder resolution', () => {
    it('picks the longest matching workspace root', async () => {
      mockDiscoverResult = makeMockConfig();

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots([
        'file:///workspace/',
        'file:///workspace/packages/sub/',
      ]);

      await manager.getConfigForFile(
        new URL('file:///workspace/packages/sub/test.malloy')
      );
      expect(discoverCalledWith[0].ceilingURL.toString()).toBe(
        'file:///workspace/packages/sub/'
      );
    });

    it('falls back to file parent when outside any workspace', async () => {
      mockDiscoverResult = makeMockConfig();

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);

      await manager.getConfigForFile(new URL('file:///other/test.malloy'));
      expect(discoverCalledWith[0].ceilingURL.toString()).toBe(
        'file:///other/'
      );
    });
  });

  describe('settings wrapper', () => {
    it('settings connections are available at level 3', async () => {
      mockDiscoverResult = null;

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);
      manager.setSecretResolver(async () => undefined);
      manager.setConnectionsConfig({
        mydb: {is: 'duckdb'},
      });

      const lookup = await manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );
      // The settings wrapper will try to create a sub-MalloyConfig
      // We can't fully test connection creation without the registry,
      // but we can verify the lookup is returned
      expect(lookup).toBeDefined();
    });

    it('settings do NOT leak into level 1 (discovered config)', async () => {
      const discoveredLookup: LookupConnection<Connection> = {
        lookupConnection: jest.fn(async (name: string) => {
          throw new Error(`Connection '${name}' not found in config`);
        }),
      };
      const mockConfig = makeMockConfig({connections: discoveredLookup});
      mockDiscoverResult = mockConfig;

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);
      manager.setSecretResolver(async () => undefined);
      manager.setConnectionsConfig({
        settingsdb: {is: 'postgres'},
      });

      const lookup = await manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );
      // The settings wrapper should NOT be installed for discovered configs
      await expect(lookup.lookupConnection('settingsdb')).rejects.toThrow();
    });
  });

  describe('postProcess wrapper', () => {
    it('calls postProcessConnection with workspace folder URL on lookup', async () => {
      // Use a mock config that returns a connection from lookupConnection
      const mockConn = {name: 'duckdb'} as unknown as Connection;
      const mockConfig = makeMockConfig({
        connections: {
          lookupConnection: jest.fn(async () => mockConn),
        },
      });
      mockDiscoverResult = mockConfig;

      const factory = makePostProcessFactory();
      const manager = new CommonConnectionManager(factory);
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);

      const lookup = await manager.getConnectionLookup(
        new URL('file:///project/nested/deep/test.malloy')
      );
      await lookup.lookupConnection('duckdb');

      // postProcess should receive the workspace folder URL, NOT
      // the file's parent directory
      expect(factory.postProcessCalls).toHaveLength(1);
      expect(factory.postProcessCalls[0].workingDir).toBe('file:///project/');
      expect(factory.postProcessCalls[0].conn).toBe(mockConn);
    });

    it('uses different working dirs for different workspace folders', async () => {
      // Return a fresh config per call so wrapConnections isn't double-applied
      const {discoverConfig: mockedDiscover} =
        jest.requireMock('@malloydata/malloy');
      (mockedDiscover as jest.Mock).mockImplementation(async () =>
        makeMockConfig()
      );

      const factory = makePostProcessFactory();
      const manager = new CommonConnectionManager(factory);
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots([
        'file:///workspace-a/',
        'file:///workspace-b/',
      ]);

      const lookupA = await manager.getConnectionLookup(
        new URL('file:///workspace-a/test.malloy')
      );
      await lookupA.lookupConnection('db');

      // Need a fresh config for workspace-b since discovery is per-folder
      const lookupB = await manager.getConnectionLookup(
        new URL('file:///workspace-b/test.malloy')
      );
      await lookupB.lookupConnection('db');

      expect(factory.postProcessCalls).toHaveLength(2);
      expect(factory.postProcessCalls[0].workingDir).toBe(
        'file:///workspace-a/'
      );
      expect(factory.postProcessCalls[1].workingDir).toBe(
        'file:///workspace-b/'
      );
    });

    it('postProcess runs on discovered config connections too', async () => {
      const mockConn = {name: 'pg'} as unknown as Connection;
      mockDiscoverResult = makeMockConfig({
        connections: {
          lookupConnection: jest.fn(async () => mockConn),
        },
      });

      const factory = makePostProcessFactory();
      const manager = new CommonConnectionManager(factory);
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);

      const lookup = await manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );
      await lookup.lookupConnection('pg');

      expect(factory.postProcessCalls).toHaveLength(1);
      expect(factory.postProcessCalls[0].workingDir).toBe('file:///project/');
    });
  });

  describe('DuckDB working directory', () => {
    it('discoverConfig ceiling is workspace root, not file directory', async () => {
      mockDiscoverResult = null;

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);

      // File is in a subdirectory
      await manager.getConfigForFile(
        new URL('file:///project/models/nested/query.malloy')
      );

      // discoverConfig should have been called with the workspace root
      // as ceiling — NOT the file's parent directory
      expect(discoverCalledWith).toHaveLength(1);
      expect(discoverCalledWith[0].ceilingURL.toString()).toBe(
        'file:///project/'
      );
      // The startURL is the file itself (discovery walks up from here)
      expect(discoverCalledWith[0].startURL.toString()).toBe(
        'file:///project/models/nested/query.malloy'
      );
    });

    it('two files in different subdirs share the same workspace-root-anchored config', async () => {
      mockDiscoverResult = makeMockConfig();

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);

      const configA = await manager.getConfigForFile(
        new URL('file:///project/models/a.malloy')
      );
      const configB = await manager.getConfigForFile(
        new URL('file:///project/queries/b.malloy')
      );

      // Same discovered config identity → same cached config
      expect(configA).toBe(configB);
      // discoverConfig called twice (different directories), but both
      // discover the same config and share the cached entry
      expect(discoverCalledWith).toHaveLength(2);
    });

    it('multi-root: files in separate roots get separate configs', async () => {
      // Each call to getConfigForFile in a different workspace folder
      // should produce a separate config with its own rootDirectory
      const {discoverConfig: mockedDiscover} =
        jest.requireMock('@malloydata/malloy');
      (mockedDiscover as jest.Mock).mockImplementation(
        async (startURL: URL, ceilingURL: URL) => {
          discoverCalledWith.push({startURL, ceilingURL});
          return makeMockConfig();
        }
      );

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project-a/', 'file:///project-b/']);

      const configA = await manager.getConfigForFile(
        new URL('file:///project-a/test.malloy')
      );
      const configB = await manager.getConfigForFile(
        new URL('file:///project-b/test.malloy')
      );

      // Different configs
      expect(configA).not.toBe(configB);
      // discoverConfig called twice with different ceilings
      expect(discoverCalledWith[0].ceilingURL.toString()).toBe(
        'file:///project-a/'
      );
      expect(discoverCalledWith[1].ceilingURL.toString()).toBe(
        'file:///project-b/'
      );
    });
  });

  describe('global config', () => {
    it('skips global config when expandHome/pathToFileURL not available (browser)', async () => {
      mockDiscoverResult = null;

      const manager = new CommonConnectionManager(makeMockFactory());
      // No hostAdapter → no expandHome or pathToFileURL
      manager.setURLReader(
        makeMockURLReader({
          'file:///home/user/.config/malloy/malloy-config.json':
            '{"connections":{}}',
        })
      );
      manager.setWorkspaceRoots(['file:///project/']);
      manager.setGlobalConfigDirectory('~/.config/malloy');

      // Should fall through to level 3 (defaults)
      const config = await manager.getConfigForFile(
        new URL('file:///project/test.malloy')
      );
      expect(config).toBeDefined();
      // discoverConfig was called (and returned null), but no global config read
    });

    it('reads global config when expandHome and pathToFileURL are available (Node)', async () => {
      mockDiscoverResult = null;

      const globalUrl = 'file:///home/user/.config/malloy/malloy-config.json';
      const manager = new CommonConnectionManager(makeMockFactory(), {
        expandHome: (p: string) => p.replace(/^~/, '/home/user'),
        pathToFileURL: (p: string) => new URL(`file://${p}`),
      });
      manager.setURLReader(
        makeMockURLReader({
          [globalUrl]: JSON.stringify({connections: {mydb: {is: 'duckdb'}}}),
        })
      );
      manager.setWorkspaceRoots(['file:///project/']);
      manager.setGlobalConfigDirectory('~/.config/malloy');

      const config = await manager.getConfigForFile(
        new URL('file:///project/test.malloy')
      );
      expect(config).toBeDefined();
    });
  });

  describe('getConnectionLookup and getConfigForFile consistency', () => {
    it('both return from the same cached config', async () => {
      mockDiscoverResult = makeMockConfig();

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);

      const url = new URL('file:///project/test.malloy');
      const config = await manager.getConfigForFile(url);
      const lookup = await manager.getConnectionLookup(url);
      expect(lookup).toBe(config.connections);
    });
  });

  describe('getEffectiveConfigSource', () => {
    it('returns defaults when no config files exist', async () => {
      mockDiscoverResult = null;

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);

      const result = await manager.getEffectiveConfigSource(
        new URL('file:///project/test.malloy')
      );
      expect(result.source).toBe('defaults');
      expect(result.configFileUri).toBeUndefined();
    });

    it('returns discovered when a project config exists', async () => {
      mockDiscoverResult = makeMockConfig({
        configURL: 'file:///project/malloy-config.json',
      });

      const manager = new CommonConnectionManager(makeMockFactory());
      manager.setURLReader(makeMockURLReader());
      manager.setWorkspaceRoots(['file:///project/']);

      const result = await manager.getEffectiveConfigSource(
        new URL('file:///project/test.malloy')
      );
      expect(result.source).toBe('discovered');
      expect(result.configFileUri).toBe('file:///project/malloy-config.json');
    });
  });
});

describe('isSecretKeyReference', () => {
  it('identifies secret key references', () => {
    expect(isSecretKeyReference({secretKey: 'my-secret'})).toBe(true);
    expect(isSecretKeyReference({secretKey: 123})).toBe(false);
    expect(isSecretKeyReference('plain string')).toBe(false);
    expect(isSecretKeyReference(null)).toBe(false);
    expect(isSecretKeyReference(undefined)).toBe(false);
    expect(isSecretKeyReference({env: 'VAR'})).toBe(false);
  });
});

describe('getDefaultConnectionTypes', () => {
  it('returns a name→type mapping', () => {
    const defaults = CommonConnectionManager.getDefaultConnectionTypes();
    expect(typeof defaults).toBe('object');
    // md alias should map to duckdb
    expect(defaults['md']).toBe('duckdb');
  });
});

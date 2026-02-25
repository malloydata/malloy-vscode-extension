import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {pathToFileURL} from 'url';
import {
  CommonConnectionManager,
  MergedConnectionLookup,
  SettingsConnectionLookup,
  isSecretKeyReference,
} from '../../src/common/connection_manager';
import {
  ConnectionFactory,
  MalloyConfigResult,
} from '../../src/common/connections/types';
import {
  LookupConnection,
  Connection,
  ConnectionConfigEntry,
  MalloyConfig,
  getRegisteredConnectionTypes,
  getConnectionProperties,
} from '@malloydata/malloy';
import {NodeConnectionFactory} from '../../src/server/connections/node/connection_factory';

// Track connectionMap values set on MalloyConfig instances
let connectionMapsSet: Record<string, ConnectionConfigEntry>[] = [];
// The lookup returned by MalloyConfig.connections
let mockConnectionsLookup: LookupConnection<Connection>;

jest.mock('@malloydata/malloy', () => {
  const actual = jest.requireActual('@malloydata/malloy');
  return {
    ...actual,
    MalloyConfig: jest.fn().mockImplementation((text: string) => {
      let _map: Record<string, ConnectionConfigEntry> | undefined;
      // Parse JSON like the real MalloyConfig does
      const parsed = JSON.parse(text);
      _map = parsed.connections;
      const instance = {
        get connectionMap(): Record<string, ConnectionConfigEntry> | undefined {
          return _map;
        },
        set connectionMap(m: Record<string, ConnectionConfigEntry>) {
          _map = m;
          connectionMapsSet.push(m);
        },
        get connections(): LookupConnection<Connection> {
          return mockConnectionsLookup;
        },
      };
      return instance;
    }),
    Manifest: jest.fn().mockImplementation(() => {
      let _buildManifest = {};
      return {
        loadText(text: string) {
          const parsed = JSON.parse(text);
          _buildManifest = parsed;
        },
        get buildManifest() {
          return _buildManifest;
        },
      };
    }),
    getRegisteredConnectionTypes: jest.fn().mockReturnValue([]),
    getConnectionProperties: jest.fn(),
  };
});

const MockMalloyConfig = MalloyConfig as jest.MockedClass<typeof MalloyConfig>;
const mockGetRegisteredConnectionTypes =
  getRegisteredConnectionTypes as jest.MockedFunction<
    typeof getRegisteredConnectionTypes
  >;
const mockGetConnectionProperties =
  getConnectionProperties as jest.MockedFunction<
    typeof getConnectionProperties
  >;

function makeMockFactory(
  findMalloyConfigImpl?: (
    fileURL: URL,
    workspaceRoots: string[],
    globalConfigDirectory?: string
  ) => MalloyConfigResult | undefined
): ConnectionFactory {
  const factory: ConnectionFactory = {
    reset: jest.fn(),
    getWorkingDirectory: jest.fn((url: URL) => {
      const path = url.pathname;
      const lastSlash = path.lastIndexOf('/');
      return lastSlash >= 0 ? path.substring(0, lastSlash) : path;
    }),
  };
  if (findMalloyConfigImpl) {
    factory.findMalloyConfig = findMalloyConfigImpl;
  }
  return factory;
}

function makeMockLookup(): LookupConnection<Connection> {
  return {
    lookupConnection: jest.fn().mockResolvedValue({} as Connection),
  };
}

describe('malloy-config.json support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectionMapsSet = [];
    mockConnectionsLookup = makeMockLookup();
  });

  describe('config file discovery', () => {
    it('returns merged lookup when findMalloyConfig finds a config file (default merged mode)', () => {
      const factory = makeMockFactory(() => ({
        configText: '{"connections": {"mydb": {"is": "duckdb"}}}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});
      const result = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      expect(result).toBeInstanceOf(MergedConnectionLookup);
      // MalloyConfig should have been constructed with the config text
      expect(MockMalloyConfig).toHaveBeenCalledWith(
        '{"connections": {"mydb": {"is": "duckdb"}}}'
      );
    });

    it('passes fileURL, workspaceRoots, and globalConfigDirectory to findMalloyConfig', () => {
      const findMalloyConfig = jest.fn().mockReturnValue(undefined);
      const factory = makeMockFactory(findMalloyConfig);

      const manager = new CommonConnectionManager(factory);
      manager.setWorkspaceRoots(['/workspace']);
      manager.setConnectionsConfig({});

      const fileURL = new URL('file:///workspace/src/test.malloy');
      manager.getConnectionLookup(fileURL);

      expect(findMalloyConfig).toHaveBeenCalledWith(
        fileURL,
        ['/workspace'],
        ''
      );
    });

    it('passes globalConfigDirectory to findMalloyConfig', () => {
      const findMalloyConfig = jest.fn().mockReturnValue(undefined);
      const factory = makeMockFactory(findMalloyConfig);

      const manager = new CommonConnectionManager(factory);
      manager.setWorkspaceRoots(['/workspace']);
      manager.setGlobalConfigDirectory('~/.config/malloy');
      manager.setConnectionsConfig({});

      const fileURL = new URL('file:///workspace/src/test.malloy');
      manager.getConnectionLookup(fileURL);

      expect(findMalloyConfig).toHaveBeenCalledWith(
        fileURL,
        ['/workspace'],
        '~/.config/malloy'
      );
    });
  });

  describe('fallback to VS Code settings', () => {
    it('falls back when no findMalloyConfig method exists', () => {
      const factory = makeMockFactory(); // no findMalloyConfig
      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});

      const result = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      // Should return a settings-based lookup, not a MergedConnectionLookup
      expect(result).not.toBeInstanceOf(MergedConnectionLookup);
    });

    it('falls back when findMalloyConfig returns undefined', () => {
      const factory = makeMockFactory(() => undefined);
      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});

      const result = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      // Should return a settings-based lookup, not a MergedConnectionLookup
      expect(result).not.toBeInstanceOf(MergedConnectionLookup);
    });
  });

  describe('error handling', () => {
    it('falls back gracefully on invalid JSON', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const factory = makeMockFactory(() => ({
        configText: '{bad json',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});

      const result = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      // Should return a settings-based lookup, not a MergedConnectionLookup
      expect(result).not.toBeInstanceOf(MergedConnectionLookup);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('/project'),
        expect.any(Error)
      );

      warnSpy.mockRestore();
    });
  });

  describe('caching', () => {
    it('does not re-parse config when text has not changed', () => {
      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);

      const url = new URL('file:///project/test.malloy');
      manager.getConnectionLookup(url);
      const callsAfterFirst = MockMalloyConfig.mock.calls.length;

      manager.getConnectionLookup(url);
      // No new MalloyConfig instances on second call (cached)
      expect(MockMalloyConfig.mock.calls.length).toBe(callsAfterFirst);
    });

    it('re-parses config when text changes', () => {
      let configText = '{"v":1}';
      const factory = makeMockFactory(() => ({
        configText,
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      const url = new URL('file:///project/test.malloy');

      manager.getConnectionLookup(url);
      const callsAfterFirst = MockMalloyConfig.mock.calls.length;

      configText = '{"v":2}';
      manager.getConnectionLookup(url);
      // Config text changed, so new MalloyConfig instances created
      expect(MockMalloyConfig.mock.calls.length).toBeGreaterThan(
        callsAfterFirst
      );
    });

    it('creates separate config lookups for files in different directories', () => {
      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);

      manager.getConnectionLookup(new URL('file:///project/src/a.malloy'));
      const callsAfterFirst = MockMalloyConfig.mock.calls.length;

      manager.getConnectionLookup(new URL('file:///project/lib/b.malloy'));
      // Different directory → new config parse (with different workingDir)
      expect(MockMalloyConfig.mock.calls.length).toBeGreaterThan(
        callsAfterFirst
      );
    });

    it('shares config lookup for files in the same directory', () => {
      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);

      manager.getConnectionLookup(new URL('file:///project/src/a.malloy'));
      const callsAfterFirst = MockMalloyConfig.mock.calls.length;

      manager.getConnectionLookup(new URL('file:///project/src/b.malloy'));
      // Same directory reuses cached config
      expect(MockMalloyConfig.mock.calls.length).toBe(callsAfterFirst);
    });

    it('picks up newly created config file', () => {
      let hasConfig = false;
      const factory = makeMockFactory(() =>
        hasConfig ? {configText: '{}', configDir: '/project'} : undefined
      );

      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});
      const url = new URL('file:///project/test.malloy');

      // No config file yet — falls back to settings
      const result1 = manager.getConnectionLookup(url);
      expect(result1).not.toBeInstanceOf(MergedConnectionLookup);

      // Config file appears — returns merged lookup
      hasConfig = true;
      const result2 = manager.getConnectionLookup(url);
      expect(result2).toBeInstanceOf(MergedConnectionLookup);
    });
  });

  describe('cache clearing', () => {
    it('clearConfigCaches causes re-parse on next access', () => {
      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      const url = new URL('file:///project/test.malloy');

      manager.getConnectionLookup(url);
      const callsAfterFirst = MockMalloyConfig.mock.calls.length;

      manager.clearConfigCaches();
      manager.getConnectionLookup(url);
      // Re-parsed because cache was cleared
      expect(MockMalloyConfig.mock.calls.length).toBeGreaterThan(
        callsAfterFirst
      );
    });

    it('setConnectionsConfig clears config caches', () => {
      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      const url = new URL('file:///project/test.malloy');

      manager.getConnectionLookup(url);
      const callsAfterFirst = MockMalloyConfig.mock.calls.length;

      manager.setConnectionsConfig({});
      manager.getConnectionLookup(url);
      // Re-parsed because setConnectionsConfig clears caches
      expect(MockMalloyConfig.mock.calls.length).toBeGreaterThan(
        callsAfterFirst
      );
    });
  });

  describe('getBuildManifest', () => {
    it('returns parsed manifest data when config has manifest', () => {
      const manifestText = JSON.stringify({
        abc123: {tableName: 'cached_mySource_abc123'},
      });
      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
        manifestText,
      }));

      const manager = new CommonConnectionManager(factory);
      const url = new URL('file:///project/test.malloy');
      manager.getConnectionLookup(url);

      const manifest = manager.getBuildManifest(url);
      expect(manifest).toBeDefined();
      expect(manifest).toEqual({
        abc123: {tableName: 'cached_mySource_abc123'},
      });
    });

    it('returns undefined when no config file exists', () => {
      const factory = makeMockFactory(() => undefined);

      const manager = new CommonConnectionManager(factory);
      const url = new URL('file:///project/test.malloy');
      manager.getConnectionLookup(url);

      expect(manager.getBuildManifest(url)).toBeUndefined();
    });

    it('returns undefined when no manifest file exists', () => {
      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
        // manifestText is undefined
      }));

      const manager = new CommonConnectionManager(factory);
      const url = new URL('file:///project/test.malloy');
      manager.getConnectionLookup(url);

      expect(manager.getBuildManifest(url)).toBeUndefined();
    });

    it('refreshes manifest cache when manifest text changes', () => {
      let manifestText = JSON.stringify({id1: {tableName: 't1'}});
      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
        manifestText,
      }));

      const manager = new CommonConnectionManager(factory);
      const url = new URL('file:///project/test.malloy');
      manager.getConnectionLookup(url);

      expect(manager.getBuildManifest(url)).toEqual({id1: {tableName: 't1'}});

      manifestText = JSON.stringify({id2: {tableName: 't2'}});
      manager.getConnectionLookup(url);

      expect(manager.getBuildManifest(url)).toEqual({id2: {tableName: 't2'}});
    });

    it('clears manifest when manifest file is deleted', () => {
      let manifestText: string | undefined = JSON.stringify({
        id1: {tableName: 't1'},
      });
      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
        manifestText,
      }));

      const manager = new CommonConnectionManager(factory);
      const url = new URL('file:///project/test.malloy');
      manager.getConnectionLookup(url);

      expect(manager.getBuildManifest(url)).toEqual({id1: {tableName: 't1'}});

      // Manifest file deleted — manifestText becomes undefined
      manifestText = undefined;
      manager.getConnectionLookup(url);

      expect(manager.getBuildManifest(url)).toBeUndefined();
    });

    it('clearConfigCaches clears manifest cache', () => {
      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
        manifestText: JSON.stringify({id1: {tableName: 't1'}}),
      }));

      const manager = new CommonConnectionManager(factory);
      const url = new URL('file:///project/test.malloy');
      manager.getConnectionLookup(url);

      expect(manager.getBuildManifest(url)).toBeDefined();

      manager.clearConfigCaches();

      expect(manager.getBuildManifest(url)).toBeUndefined();
    });
  });

  describe('projectConnectionsOnly', () => {
    it('returns config lookup when projectConnectionsOnly is set and config exists', async () => {
      const mockConn = {} as Connection;
      mockConnectionsLookup = {
        lookupConnection: jest.fn().mockResolvedValue(mockConn),
      };

      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      manager.setProjectConnectionsOnly(true);

      const result = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      // The lookup is wrapped to track connections, so check it delegates correctly
      const conn = await result.lookupConnection('test');
      expect(conn).toBe(mockConn);
      expect(mockConnectionsLookup.lookupConnection).toHaveBeenCalledWith(
        'test'
      );
    });

    it('rejects lookups when projectConnectionsOnly is set and no config exists', async () => {
      const factory = makeMockFactory(() => undefined);

      const manager = new CommonConnectionManager(factory);
      manager.setProjectConnectionsOnly(true);

      const lookup = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      await expect(lookup.lookupConnection('mydb')).rejects.toThrow(
        /projectConnectionsOnly/
      );
    });

    it('ignores settings connections when projectConnectionsOnly is set', async () => {
      const factory = makeMockFactory(() => undefined);

      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({mydb: {is: 'duckdb'}});
      manager.setProjectConnectionsOnly(true);

      const lookup = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      // mydb is in settings but should be unreachable
      await expect(lookup.lookupConnection('mydb')).rejects.toThrow(
        /projectConnectionsOnly/
      );
    });

    it('ignores default connections when projectConnectionsOnly is set', async () => {
      const factory = makeMockFactory(() => undefined);

      const manager = new CommonConnectionManager(factory);
      // duckdb would normally resolve as a default connection
      manager.setConnectionsConfig({duckdb: {is: 'duckdb'}});
      manager.setProjectConnectionsOnly(true);

      const lookup = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      await expect(lookup.lookupConnection('duckdb')).rejects.toThrow(
        /projectConnectionsOnly/
      );
    });

    it('does not pass globalConfigDirectory when projectConnectionsOnly is set', () => {
      const findMalloyConfig = jest.fn().mockReturnValue(undefined);
      const factory = makeMockFactory(findMalloyConfig);

      const manager = new CommonConnectionManager(factory);
      manager.setGlobalConfigDirectory('~/.config/malloy');
      manager.setProjectConnectionsOnly(true);

      const url = new URL('file:///project/test.malloy');
      manager.getConnectionLookup(url);

      expect(findMalloyConfig).toHaveBeenCalledWith(expect.any(URL), [], '');
    });

    it('passes globalConfigDirectory when projectConnectionsOnly is not set', () => {
      const findMalloyConfig = jest.fn().mockReturnValue(undefined);
      const factory = makeMockFactory(findMalloyConfig);

      const manager = new CommonConnectionManager(factory);
      manager.setGlobalConfigDirectory('~/.config/malloy');
      manager.setConnectionsConfig({});

      const url = new URL('file:///project/test.malloy');
      manager.getConnectionLookup(url);

      expect(findMalloyConfig).toHaveBeenCalledWith(
        expect.any(URL),
        [],
        '~/.config/malloy'
      );
    });

    it('returns MergedConnectionLookup when config exists (default behavior)', () => {
      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});

      const result = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      expect(result).toBeInstanceOf(MergedConnectionLookup);
    });

    it('falls back to settings when no config exists (default behavior)', () => {
      const factory = makeMockFactory(() => undefined);

      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});

      const result = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      // Should return a settings-based lookup, not a MergedConnectionLookup
      expect(result).not.toBeInstanceOf(MergedConnectionLookup);
    });
  });

  describe('default connections from registry', () => {
    it('includes registered types as default connections', () => {
      mockGetRegisteredConnectionTypes.mockReturnValue(['duckdb', 'postgres']);

      const factory = makeMockFactory(() => undefined);
      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({}); // empty user config

      // Trigger lazy creation of settings lookup
      manager.getConnectionLookup(new URL('file:///project/test.malloy'));

      // The merged config should include defaults from the registry plus md alias
      expect(connectionMapsSet).toContainEqual(
        expect.objectContaining({
          duckdb: {is: 'duckdb'},
          postgres: {is: 'postgres'},
          md: {is: 'duckdb', databasePath: 'md:'},
        })
      );
    });

    it('user settings override defaults with the same name', () => {
      mockGetRegisteredConnectionTypes.mockReturnValue(['duckdb']);

      const factory = makeMockFactory(() => undefined);
      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({
        duckdb: {is: 'duckdb', workingDirectory: '/data'},
      });

      // Trigger lazy creation of settings lookup
      manager.getConnectionLookup(new URL('file:///project/test.malloy'));

      expect(connectionMapsSet).toContainEqual(
        expect.objectContaining({
          duckdb: {is: 'duckdb', workingDirectory: '/data'},
        })
      );
    });

    it('always includes md (MotherDuck) alias', () => {
      mockGetRegisteredConnectionTypes.mockReturnValue([]);

      const factory = makeMockFactory(() => undefined);
      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});

      // Trigger lazy creation of settings lookup
      manager.getConnectionLookup(new URL('file:///project/test.malloy'));

      expect(connectionMapsSet).toContainEqual(
        expect.objectContaining({
          md: {is: 'duckdb', databasePath: 'md:'},
        })
      );
    });
  });

  describe('working directory injection', () => {
    it('calls getWorkingDirectory with the file URL', () => {
      const factory = makeMockFactory(() => undefined);
      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});

      const fileURL = new URL('file:///project/src/test.malloy');
      manager.getConnectionLookup(fileURL);

      expect(factory.getWorkingDirectory).toHaveBeenCalledWith(fileURL);
    });

    it('injects workingDirectory for types that support it (config file path)', () => {
      mockGetConnectionProperties.mockImplementation((typeName: string) => {
        if (typeName === 'duckdb') {
          return [
            {
              name: 'workingDirectory',
              displayName: 'Working Directory',
              type: 'string',
            },
          ];
        }
        return undefined;
      });

      const factory = makeMockFactory(() => ({
        configText: '{"connections": {"mydb": {"is": "duckdb"}}}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});

      manager.getConnectionLookup(new URL('file:///project/src/test.malloy'));

      // connectionMap should have workingDirectory injected
      expect(connectionMapsSet).toContainEqual({
        mydb: {is: 'duckdb', workingDirectory: '/project/src'},
      });
    });

    it('preserves explicit workingDirectory in config (does not override)', () => {
      mockGetConnectionProperties.mockImplementation((typeName: string) => {
        if (typeName === 'duckdb') {
          return [
            {
              name: 'workingDirectory',
              displayName: 'Working Directory',
              type: 'string',
            },
          ];
        }
        return undefined;
      });

      const factory = makeMockFactory(() => ({
        configText:
          '{"connections": {"mydb": {"is": "duckdb", "workingDirectory": "/custom/dir"}}}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});

      manager.getConnectionLookup(new URL('file:///project/src/test.malloy'));

      // Explicit workingDirectory should be preserved
      expect(connectionMapsSet).toContainEqual({
        mydb: {is: 'duckdb', workingDirectory: '/custom/dir'},
      });
    });

    it('files in different directories get different config cache entries', () => {
      mockGetConnectionProperties.mockImplementation((typeName: string) => {
        if (typeName === 'duckdb') {
          return [
            {
              name: 'workingDirectory',
              displayName: 'Working Directory',
              type: 'string',
            },
          ];
        }
        return undefined;
      });

      const factory = makeMockFactory(() => ({
        configText: '{"connections": {"mydb": {"is": "duckdb"}}}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});

      manager.getConnectionLookup(new URL('file:///project/src/test.malloy'));
      manager.getConnectionLookup(new URL('file:///project/lib/other.malloy'));

      // Each directory gets separate connection map with its own workingDirectory
      expect(connectionMapsSet).toContainEqual({
        mydb: {is: 'duckdb', workingDirectory: '/project/src'},
      });
      expect(connectionMapsSet).toContainEqual({
        mydb: {is: 'duckdb', workingDirectory: '/project/lib'},
      });
    });

    it('does not inject workingDirectory for types that do not support it', () => {
      // getConnectionProperties returns no workingDirectory property
      mockGetConnectionProperties.mockReturnValue([
        {name: 'host', displayName: 'Host', type: 'string'},
      ]);

      const factory = makeMockFactory(() => ({
        configText: '{"connections": {"mydb": {"is": "postgres"}}}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});

      manager.getConnectionLookup(new URL('file:///project/src/test.malloy'));

      // Config file connection map should not have workingDirectory
      expect(connectionMapsSet).toContainEqual({
        mydb: {is: 'postgres'},
      });
    });

    it('injects workingDirectory into settings lookup (non-resolver path)', () => {
      mockGetRegisteredConnectionTypes.mockReturnValue(['duckdb']);
      mockGetConnectionProperties.mockImplementation((typeName: string) => {
        if (typeName === 'duckdb') {
          return [
            {
              name: 'workingDirectory',
              displayName: 'Working Directory',
              type: 'string',
            },
          ];
        }
        return undefined;
      });

      const factory = makeMockFactory(() => undefined); // no config file
      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});

      manager.getConnectionLookup(new URL('file:///project/src/test.malloy'));

      // The settings lookup should have workingDirectory injected
      expect(connectionMapsSet).toContainEqual(
        expect.objectContaining({
          duckdb: {is: 'duckdb', workingDirectory: '/project/src'},
        })
      );
    });
  });

  describe('MergedConnectionLookup', () => {
    it('uses primary when it succeeds', async () => {
      const primary: LookupConnection<Connection> = {
        lookupConnection: jest.fn().mockResolvedValue({name: 'from-config'}),
      };
      const fallback: LookupConnection<Connection> = {
        lookupConnection: jest.fn().mockResolvedValue({name: 'from-settings'}),
      };

      const merged = new MergedConnectionLookup(primary, fallback);
      const result = await merged.lookupConnection('mydb');

      expect(result).toEqual({name: 'from-config'});
      expect(fallback.lookupConnection).not.toHaveBeenCalled();
    });

    it('falls back to secondary when primary fails', async () => {
      const primary: LookupConnection<Connection> = {
        lookupConnection: jest
          .fn()
          .mockRejectedValue(new Error('not found in config')),
      };
      const fallback: LookupConnection<Connection> = {
        lookupConnection: jest.fn().mockResolvedValue({name: 'from-settings'}),
      };

      const merged = new MergedConnectionLookup(primary, fallback);
      const result = await merged.lookupConnection('mydb');

      expect(result).toEqual({name: 'from-settings'});
    });

    it('throws when both primary and fallback fail', async () => {
      const primary: LookupConnection<Connection> = {
        lookupConnection: jest
          .fn()
          .mockRejectedValue(new Error('not in config')),
      };
      const fallback: LookupConnection<Connection> = {
        lookupConnection: jest
          .fn()
          .mockRejectedValue(new Error('not in settings')),
      };

      const merged = new MergedConnectionLookup(primary, fallback);
      await expect(merged.lookupConnection('mydb')).rejects.toThrow(
        'not in settings'
      );
    });
  });
});

describe('isSecretKeyReference', () => {
  it('returns true for {secretKey: string}', () => {
    expect(isSecretKeyReference({secretKey: 'connections.mydb.password'})).toBe(
      true
    );
  });

  it('returns false for plain string', () => {
    expect(isSecretKeyReference('hello')).toBe(false);
  });

  it('returns false for {env: string}', () => {
    expect(isSecretKeyReference({env: 'MY_VAR'})).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSecretKeyReference(null)).toBe(false);
  });

  it('returns false for number', () => {
    expect(isSecretKeyReference(42)).toBe(false);
  });

  it('returns false for object with non-string secretKey', () => {
    expect(isSecretKeyReference({secretKey: 123})).toBe(false);
  });
});

describe('SettingsConnectionLookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectionMapsSet = [];
    mockConnectionsLookup = makeMockLookup();
  });

  it('resolves {secretKey} values via the resolver', async () => {
    const mockConnection = {name: 'mydb'} as unknown as Connection;
    mockConnectionsLookup = {
      lookupConnection: jest.fn().mockResolvedValue(mockConnection),
    };

    const resolver = jest.fn().mockResolvedValue('s3cret');
    const config: Record<string, ConnectionConfigEntry> = {
      mydb: {
        is: 'postgres',
        host: 'localhost',
        password: {secretKey: 'connections.mydb.password'} as unknown as string,
      },
    };

    const lookup = new SettingsConnectionLookup(config, resolver);
    const result = await lookup.lookupConnection('mydb');

    expect(result).toBe(mockConnection);
    expect(resolver).toHaveBeenCalledWith('connections.mydb.password');
    // Verify the resolved config has the secret
    expect(connectionMapsSet).toContainEqual({
      mydb: {is: 'postgres', host: 'localhost', password: 's3cret'},
    });
  });

  it('passes through string and {env} values unchanged', async () => {
    const resolver = jest.fn();
    const config: Record<string, ConnectionConfigEntry> = {
      mydb: {
        is: 'postgres',
        host: 'localhost',
        port: 5432 as unknown as string,
        password: {env: 'PG_PASSWORD'} as unknown as string,
      },
    };

    const lookup = new SettingsConnectionLookup(config, resolver);
    await lookup.lookupConnection('mydb');

    // resolver should NOT be called — no {secretKey} values
    expect(resolver).not.toHaveBeenCalled();
    expect(connectionMapsSet).toContainEqual({
      mydb: {
        is: 'postgres',
        host: 'localhost',
        port: 5432,
        password: {env: 'PG_PASSWORD'},
      },
    });
  });

  it('drops {secretKey} when resolver returns undefined', async () => {
    const resolver = jest.fn().mockResolvedValue(undefined);
    const config: Record<string, ConnectionConfigEntry> = {
      mydb: {
        is: 'postgres',
        host: 'localhost',
        password: {secretKey: 'connections.mydb.password'} as unknown as string,
      },
    };

    const lookup = new SettingsConnectionLookup(config, resolver);
    await lookup.lookupConnection('mydb');

    expect(resolver).toHaveBeenCalledWith('connections.mydb.password');
    // password should be omitted since resolver returned undefined
    expect(connectionMapsSet).toContainEqual({
      mydb: {is: 'postgres', host: 'localhost'},
    });
  });

  it('throws for unknown connection name', async () => {
    const resolver = jest.fn();
    const config: Record<string, ConnectionConfigEntry> = {
      mydb: {is: 'duckdb'},
    };

    const lookup = new SettingsConnectionLookup(config, resolver);
    await expect(lookup.lookupConnection('unknown')).rejects.toThrow(
      "No connection named 'unknown'"
    );
  });
});

describe('CommonConnectionManager with secretResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectionMapsSet = [];
    mockConnectionsLookup = makeMockLookup();
  });

  it('uses SettingsConnectionLookup when secretResolver is set', () => {
    const factory = makeMockFactory();
    const manager = new CommonConnectionManager(factory);
    manager.setSecretResolver(async () => 'resolved');
    manager.setConnectionsConfig({mydb: {is: 'duckdb'}});

    const lookup = manager.getConnectionLookup(
      new URL('file:///project/test.malloy')
    );

    // Should be a SettingsConnectionLookup (not a plain registry lookup)
    expect(lookup).toBeInstanceOf(SettingsConnectionLookup);
  });

  it('uses MalloyConfig directly when no secretResolver is set', () => {
    const factory = makeMockFactory();
    const manager = new CommonConnectionManager(factory);
    // No setSecretResolver call
    manager.setConnectionsConfig({mydb: {is: 'duckdb'}});

    const lookup = manager.getConnectionLookup(
      new URL('file:///project/test.malloy')
    );

    // Should NOT be SettingsConnectionLookup
    expect(lookup).not.toBeInstanceOf(SettingsConnectionLookup);
    // MalloyConfig is used to create the connections
    expect(connectionMapsSet.length).toBeGreaterThan(0);
  });
});

describe('NodeConnectionFactory.findMalloyConfig', () => {
  let tmpDir: string;
  let factory: NodeConnectionFactory;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'malloy-test-'));
    factory = new NodeConnectionFactory();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  });

  it('finds config at workspace root', () => {
    const configContent = '{"connections":{}}';
    fs.writeFileSync(path.join(tmpDir, 'malloy-config.json'), configContent);
    fs.mkdirSync(path.join(tmpDir, 'src'), {recursive: true});

    const fileURL = pathToFileURL(path.join(tmpDir, 'src', 'test.malloy'));
    const result = factory.findMalloyConfig(fileURL, [tmpDir]);

    expect(result).toBeDefined();
    expect(result!.configText).toBe(configContent);
    expect(result!.configDir).toBe(tmpDir);
  });

  it('does NOT find config in intermediate directories (no walk)', () => {
    // Config in src/ (intermediate), NOT in workspace root
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, {recursive: true});
    fs.mkdirSync(path.join(srcDir, 'models'), {recursive: true});
    fs.writeFileSync(
      path.join(srcDir, 'malloy-config.json'),
      '{"connections":{}}'
    );

    const fileURL = pathToFileURL(path.join(srcDir, 'models', 'test.malloy'));
    const result = factory.findMalloyConfig(fileURL, [tmpDir]);

    // Should NOT find it — only checks workspace root, not intermediate dirs
    expect(result).toBeUndefined();
  });

  it('uses file directory when no workspace roots', () => {
    const fileDir = path.join(tmpDir, 'myproject');
    fs.mkdirSync(fileDir, {recursive: true});
    const configContent = '{"connections":{"db":{}}}';
    fs.writeFileSync(path.join(fileDir, 'malloy-config.json'), configContent);

    const fileURL = pathToFileURL(path.join(fileDir, 'test.malloy'));
    const result = factory.findMalloyConfig(fileURL, []);

    expect(result).toBeDefined();
    expect(result!.configText).toBe(configContent);
    expect(result!.configDir).toBe(fileDir);
  });

  it('returns undefined when no config exists', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), {recursive: true});

    const fileURL = pathToFileURL(path.join(tmpDir, 'src', 'test.malloy'));
    const result = factory.findMalloyConfig(fileURL, [tmpDir]);

    expect(result).toBeUndefined();
  });

  it('falls back to global config directory when no workspace config', () => {
    const globalDir = path.join(tmpDir, 'global');
    fs.mkdirSync(globalDir, {recursive: true});
    const configContent = '{"connections":{"db":{"is":"duckdb"}}}';
    fs.writeFileSync(path.join(globalDir, 'malloy-config.json'), configContent);
    fs.mkdirSync(path.join(tmpDir, 'workspace', 'src'), {recursive: true});

    const fileURL = pathToFileURL(
      path.join(tmpDir, 'workspace', 'src', 'test.malloy')
    );
    const result = factory.findMalloyConfig(
      fileURL,
      [path.join(tmpDir, 'workspace')],
      globalDir
    );

    expect(result).toBeDefined();
    expect(result!.configText).toBe(configContent);
    expect(result!.configDir).toBe(globalDir);
  });

  it('workspace config takes priority over global config directory', () => {
    const globalDir = path.join(tmpDir, 'global');
    fs.mkdirSync(globalDir, {recursive: true});
    fs.writeFileSync(
      path.join(globalDir, 'malloy-config.json'),
      '{"connections":{"db":{"is":"postgres"}}}'
    );

    const workspaceContent = '{"connections":{"db":{"is":"duckdb"}}}';
    fs.writeFileSync(path.join(tmpDir, 'malloy-config.json'), workspaceContent);
    fs.mkdirSync(path.join(tmpDir, 'src'), {recursive: true});

    const fileURL = pathToFileURL(path.join(tmpDir, 'src', 'test.malloy'));
    const result = factory.findMalloyConfig(fileURL, [tmpDir], globalDir);

    expect(result).toBeDefined();
    expect(result!.configText).toBe(workspaceContent);
    expect(result!.configDir).toBe(tmpDir);
  });

  it('handles multi-root workspaces with different configs', () => {
    const rootA = path.join(tmpDir, 'project_a');
    const rootB = path.join(tmpDir, 'project_b');
    fs.mkdirSync(rootA, {recursive: true});
    fs.mkdirSync(rootB, {recursive: true});

    fs.writeFileSync(
      path.join(rootA, 'malloy-config.json'),
      '{"connections":{"db":{"is":"duckdb"}}}'
    );
    fs.writeFileSync(
      path.join(rootB, 'malloy-config.json'),
      '{"connections":{"db":{"is":"postgres"}}}'
    );

    const roots = [rootA, rootB];

    const resultA = factory.findMalloyConfig(
      pathToFileURL(path.join(rootA, 'test.malloy')),
      roots
    );
    const resultB = factory.findMalloyConfig(
      pathToFileURL(path.join(rootB, 'test.malloy')),
      roots
    );

    expect(resultA).toBeDefined();
    expect(resultB).toBeDefined();
    expect(resultA!.configDir).toBe(rootA);
    expect(resultB!.configDir).toBe(rootB);
    expect(resultA!.configText).not.toBe(resultB!.configText);
  });

  it('returns manifestText when manifest file exists at default path', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'malloy-config.json'),
      '{"connections":{}}'
    );
    const manifestDir = path.join(tmpDir, 'MANIFESTS');
    fs.mkdirSync(manifestDir, {recursive: true});
    const manifestContent = '{"abc123":{"tableName":"cached_table"}}';
    fs.writeFileSync(
      path.join(manifestDir, 'malloy-manifest.json'),
      manifestContent
    );

    const fileURL = pathToFileURL(path.join(tmpDir, 'test.malloy'));
    const result = factory.findMalloyConfig(fileURL, [tmpDir]);

    expect(result).toBeDefined();
    expect(result!.manifestText).toBe(manifestContent);
  });

  it('reads manifest from custom manifestPath', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'malloy-config.json'),
      '{"connections":{},"manifestPath":"custom"}'
    );
    const manifestDir = path.join(tmpDir, 'custom');
    fs.mkdirSync(manifestDir, {recursive: true});
    const manifestContent = '{"def456":{"tableName":"other_table"}}';
    fs.writeFileSync(
      path.join(manifestDir, 'malloy-manifest.json'),
      manifestContent
    );

    const fileURL = pathToFileURL(path.join(tmpDir, 'test.malloy'));
    const result = factory.findMalloyConfig(fileURL, [tmpDir]);

    expect(result).toBeDefined();
    expect(result!.manifestText).toBe(manifestContent);
  });

  it('returns undefined manifestText when no manifest file exists', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'malloy-config.json'),
      '{"connections":{}}'
    );

    const fileURL = pathToFileURL(path.join(tmpDir, 'test.malloy'));
    const result = factory.findMalloyConfig(fileURL, [tmpDir]);

    expect(result).toBeDefined();
    expect(result!.manifestText).toBeUndefined();
  });
});

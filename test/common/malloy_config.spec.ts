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
  readConnectionsConfig,
  createConnectionsFromConfig,
  getRegisteredConnectionTypes,
} from '@malloydata/malloy';
import {NodeConnectionFactory} from '../../src/server/connections/node/connection_factory';

// Mock readConnectionsConfig, createConnectionsFromConfig, and getRegisteredConnectionTypes
jest.mock('@malloydata/malloy', () => {
  const actual = jest.requireActual('@malloydata/malloy');
  return {
    ...actual,
    readConnectionsConfig: jest.fn(),
    createConnectionsFromConfig: jest.fn(),
    getRegisteredConnectionTypes: jest.fn().mockReturnValue([]),
  };
});

const mockReadConnectionsConfig = readConnectionsConfig as jest.MockedFunction<
  typeof readConnectionsConfig
>;
const mockCreateConnectionsFromConfig =
  createConnectionsFromConfig as jest.MockedFunction<
    typeof createConnectionsFromConfig
  >;
const mockGetRegisteredConnectionTypes =
  getRegisteredConnectionTypes as jest.MockedFunction<
    typeof getRegisteredConnectionTypes
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
  });

  describe('config file discovery', () => {
    it('returns merged lookup when findMalloyConfig finds a config file (default merged mode)', () => {
      const mockLookup = makeMockLookup();
      mockReadConnectionsConfig.mockReturnValue({connections: {}});
      mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

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
      expect(mockReadConnectionsConfig).toHaveBeenCalledWith(
        '{"connections": {"mydb": {"is": "duckdb"}}}'
      );
      expect(mockCreateConnectionsFromConfig).toHaveBeenCalled();
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
      expect(mockReadConnectionsConfig).not.toHaveBeenCalled();
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

      mockReadConnectionsConfig.mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

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
      const mockLookup = makeMockLookup();
      mockReadConnectionsConfig.mockReturnValue({connections: {}});
      mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);

      const url = new URL('file:///project/test.malloy');
      manager.getConnectionLookup(url);
      manager.getConnectionLookup(url);

      // Config file is read each time, but only parsed once
      expect(mockReadConnectionsConfig).toHaveBeenCalledTimes(1);
    });

    it('re-parses config when text changes', () => {
      const mockLookup = makeMockLookup();
      mockReadConnectionsConfig.mockReturnValue({connections: {}});
      mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

      let configText = '{"v":1}';
      const factory = makeMockFactory(() => ({
        configText,
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      const url = new URL('file:///project/test.malloy');

      manager.getConnectionLookup(url);
      expect(mockReadConnectionsConfig).toHaveBeenCalledTimes(1);

      configText = '{"v":2}';
      manager.getConnectionLookup(url);
      expect(mockReadConnectionsConfig).toHaveBeenCalledTimes(2);
    });

    it('shares config lookup for files in sibling subdirs with same config', () => {
      const mockLookup = makeMockLookup();
      mockReadConnectionsConfig.mockReturnValue({connections: {}});
      mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);

      manager.getConnectionLookup(new URL('file:///project/src/a.malloy'));
      manager.getConnectionLookup(new URL('file:///project/lib/b.malloy'));

      // readConnectionsConfig called only once — second dir reuses parsed config
      expect(mockReadConnectionsConfig).toHaveBeenCalledTimes(1);
    });

    it('picks up newly created config file', () => {
      const mockLookup = makeMockLookup();
      mockReadConnectionsConfig.mockReturnValue({connections: {}});
      mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

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
      const mockLookup = makeMockLookup();
      mockReadConnectionsConfig.mockReturnValue({connections: {}});
      mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      const url = new URL('file:///project/test.malloy');

      manager.getConnectionLookup(url);
      expect(mockReadConnectionsConfig).toHaveBeenCalledTimes(1);

      manager.clearConfigCaches();
      manager.getConnectionLookup(url);
      // Re-parsed because cache was cleared
      expect(mockReadConnectionsConfig).toHaveBeenCalledTimes(2);
    });

    it('setConnectionsConfig clears config caches', () => {
      const mockLookup = makeMockLookup();
      mockReadConnectionsConfig.mockReturnValue({connections: {}});
      mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      const url = new URL('file:///project/test.malloy');

      manager.getConnectionLookup(url);
      expect(mockReadConnectionsConfig).toHaveBeenCalledTimes(1);

      manager.setConnectionsConfig({});
      manager.getConnectionLookup(url);
      expect(mockReadConnectionsConfig).toHaveBeenCalledTimes(2);
    });
  });

  describe('projectConnectionsOnly', () => {
    it('returns config lookup when projectConnectionsOnly is set and config exists', () => {
      const mockLookup = makeMockLookup();
      mockReadConnectionsConfig.mockReturnValue({connections: {}});
      mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

      const factory = makeMockFactory(() => ({
        configText: '{}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      manager.setProjectConnectionsOnly(true);

      const result = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      expect(result).toBe(mockLookup);
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
      const mockLookup = makeMockLookup();
      mockReadConnectionsConfig.mockReturnValue({connections: {}});
      mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

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
      // createConnectionsFromConfig is called with the merged config
      const mockLookup = makeMockLookup();
      mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

      const factory = makeMockFactory(() => undefined);
      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({}); // empty user config

      // The merged config passed to createConnectionsFromConfig should
      // include defaults from the registry plus the md alias
      expect(mockCreateConnectionsFromConfig).toHaveBeenCalledWith({
        connections: expect.objectContaining({
          duckdb: {is: 'duckdb'},
          postgres: {is: 'postgres'},
          md: {is: 'duckdb', databasePath: 'md:'},
        }),
      });
    });

    it('user settings override defaults with the same name', () => {
      mockGetRegisteredConnectionTypes.mockReturnValue(['duckdb']);
      const mockLookup = makeMockLookup();
      mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

      const factory = makeMockFactory(() => undefined);
      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({
        duckdb: {is: 'duckdb', workingDirectory: '/data'},
      });

      expect(mockCreateConnectionsFromConfig).toHaveBeenCalledWith({
        connections: expect.objectContaining({
          duckdb: {is: 'duckdb', workingDirectory: '/data'},
        }),
      });
    });

    it('always includes md (MotherDuck) alias', () => {
      mockGetRegisteredConnectionTypes.mockReturnValue([]);
      const mockLookup = makeMockLookup();
      mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

      const factory = makeMockFactory(() => undefined);
      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig({});

      expect(mockCreateConnectionsFromConfig).toHaveBeenCalledWith({
        connections: expect.objectContaining({
          md: {is: 'duckdb', databasePath: 'md:'},
        }),
      });
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
  });

  it('resolves {secretKey} values via the resolver', async () => {
    const mockConnection = {name: 'mydb'} as unknown as Connection;
    const mockLookup = {
      lookupConnection: jest.fn().mockResolvedValue(mockConnection),
    };
    mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

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
    // Verify the config passed to createConnectionsFromConfig has resolved secret
    expect(mockCreateConnectionsFromConfig).toHaveBeenCalledWith({
      connections: {
        mydb: {is: 'postgres', host: 'localhost', password: 's3cret'},
      },
    });
  });

  it('passes through string and {env} values unchanged', async () => {
    const mockConnection = {} as Connection;
    const mockLookup = {
      lookupConnection: jest.fn().mockResolvedValue(mockConnection),
    };
    mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

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
    expect(mockCreateConnectionsFromConfig).toHaveBeenCalledWith({
      connections: {
        mydb: {
          is: 'postgres',
          host: 'localhost',
          port: 5432,
          password: {env: 'PG_PASSWORD'},
        },
      },
    });
  });

  it('drops {secretKey} when resolver returns undefined', async () => {
    const mockConnection = {} as Connection;
    const mockLookup = {
      lookupConnection: jest.fn().mockResolvedValue(mockConnection),
    };
    mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

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
    expect(mockCreateConnectionsFromConfig).toHaveBeenCalledWith({
      connections: {
        mydb: {is: 'postgres', host: 'localhost'},
      },
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

  it('uses createConnectionsFromConfig directly when no secretResolver is set', () => {
    const mockLookup = makeMockLookup();
    mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

    const factory = makeMockFactory();
    const manager = new CommonConnectionManager(factory);
    // No setSecretResolver call
    manager.setConnectionsConfig({mydb: {is: 'duckdb'}});

    const lookup = manager.getConnectionLookup(
      new URL('file:///project/test.malloy')
    );

    // Should NOT be SettingsConnectionLookup
    expect(lookup).not.toBeInstanceOf(SettingsConnectionLookup);
    expect(mockCreateConnectionsFromConfig).toHaveBeenCalled();
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
});

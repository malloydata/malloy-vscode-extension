import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {pathToFileURL} from 'url';
import {
  CommonConnectionManager,
  DynamicConnectionLookup,
} from '../../src/common/connection_manager';
import {
  ConnectionFactory,
  MalloyConfigResult,
} from '../../src/common/connections/types';
import {ConnectionConfig} from '../../src/common/types/connection_manager_types';
import {
  TestableConnection,
  LookupConnection,
  Connection,
  readConnectionsConfig,
  createConnectionsFromConfig,
} from '@malloydata/malloy';
import {NodeConnectionFactory} from '../../src/server/connections/node/connection_factory';

// Mock readConnectionsConfig and createConnectionsFromConfig
jest.mock('@malloydata/malloy', () => {
  const actual = jest.requireActual('@malloydata/malloy');
  return {
    ...actual,
    readConnectionsConfig: jest.fn(),
    createConnectionsFromConfig: jest.fn(),
  };
});

const mockReadConnectionsConfig = readConnectionsConfig as jest.MockedFunction<
  typeof readConnectionsConfig
>;
const mockCreateConnectionsFromConfig =
  createConnectionsFromConfig as jest.MockedFunction<
    typeof createConnectionsFromConfig
  >;

function makeMockFactory(
  findMalloyConfigImpl?: (
    fileURL: URL,
    workspaceRoots: string[]
  ) => MalloyConfigResult | undefined
): ConnectionFactory {
  const factory: ConnectionFactory = {
    reset: jest.fn(),
    getConnectionForConfig: jest
      .fn()
      .mockResolvedValue({} as TestableConnection),
    getWorkingDirectory: jest.fn((url: URL) => {
      const path = url.pathname;
      const lastSlash = path.lastIndexOf('/');
      return lastSlash >= 0 ? path.substring(0, lastSlash) : path;
    }),
    addDefaults: jest.fn((configs: ConnectionConfig[]) => configs),
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
    it('returns config lookup when findMalloyConfig finds a config file', () => {
      const mockLookup = makeMockLookup();
      mockReadConnectionsConfig.mockReturnValue({connections: {}});
      mockCreateConnectionsFromConfig.mockReturnValue(mockLookup);

      const factory = makeMockFactory(() => ({
        configText: '{"connections": {"mydb": {"is": "duckdb"}}}',
        configDir: '/project',
      }));

      const manager = new CommonConnectionManager(factory);
      const result = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      expect(result).toBe(mockLookup);
      expect(mockReadConnectionsConfig).toHaveBeenCalledWith(
        '{"connections": {"mydb": {"is": "duckdb"}}}'
      );
      expect(mockCreateConnectionsFromConfig).toHaveBeenCalled();
    });

    it('passes fileURL and workspaceRoots to findMalloyConfig', () => {
      const findMalloyConfig = jest.fn().mockReturnValue(undefined);
      const factory = makeMockFactory(findMalloyConfig);

      const manager = new CommonConnectionManager(factory);
      manager.setWorkspaceRoots(['/workspace']);
      manager.setConnectionsConfig([]);

      const fileURL = new URL('file:///workspace/src/test.malloy');
      manager.getConnectionLookup(fileURL);

      expect(findMalloyConfig).toHaveBeenCalledWith(fileURL, ['/workspace']);
    });
  });

  describe('fallback to VS Code settings', () => {
    it('falls back when no findMalloyConfig method exists', () => {
      const factory = makeMockFactory(); // no findMalloyConfig
      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig([]);

      const result = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      expect(result).toBeInstanceOf(DynamicConnectionLookup);
      expect(mockReadConnectionsConfig).not.toHaveBeenCalled();
    });

    it('falls back when findMalloyConfig returns undefined', () => {
      const factory = makeMockFactory(() => undefined);
      const manager = new CommonConnectionManager(factory);
      manager.setConnectionsConfig([]);

      const result = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      expect(result).toBeInstanceOf(DynamicConnectionLookup);
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
      manager.setConnectionsConfig([]);

      const result = manager.getConnectionLookup(
        new URL('file:///project/test.malloy')
      );

      expect(result).toBeInstanceOf(DynamicConnectionLookup);
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

      const result1 = manager.getConnectionLookup(
        new URL('file:///project/src/a.malloy')
      );
      const result2 = manager.getConnectionLookup(
        new URL('file:///project/lib/b.malloy')
      );

      expect(result1).toBe(result2);
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
      manager.setConnectionsConfig([]);
      const url = new URL('file:///project/test.malloy');

      // No config file yet — falls back to VS Code settings
      const result1 = manager.getConnectionLookup(url);
      expect(result1).toBeInstanceOf(DynamicConnectionLookup);

      // Config file appears
      hasConfig = true;
      const result2 = manager.getConnectionLookup(url);
      expect(result2).toBe(mockLookup);
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

      manager.setConnectionsConfig([]);
      manager.getConnectionLookup(url);
      expect(mockReadConnectionsConfig).toHaveBeenCalledTimes(2);
    });
  });
});

describe('NodeConnectionFactory.findMalloyConfig', () => {
  let tmpDir: string;
  let factory: NodeConnectionFactory;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'malloy-test-'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    factory = new NodeConnectionFactory({} as any);
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

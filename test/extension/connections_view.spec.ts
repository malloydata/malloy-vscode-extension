/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockReadFile = jest.fn();
const mockGetConfiguration = jest.fn();
const mockAsRelativePath = jest.fn((uri: any) => uri.fsPath ?? uri.toString());
const mockCreateFileSystemWatcher = jest.fn(() => ({
  onDidCreate: jest.fn(() => ({dispose: jest.fn()})),
  onDidChange: jest.fn(() => ({dispose: jest.fn()})),
  onDidDelete: jest.fn(() => ({dispose: jest.fn()})),
  dispose: jest.fn(),
}));
const mockGetWorkspaceFolder = jest.fn();
const mockOnDidChangeActiveTextEditor = jest.fn(() => ({dispose: jest.fn()}));
let mockActiveTextEditor: any = undefined;

jest.mock(
  'vscode',
  () => ({
    TreeItem: class MockTreeItem {
      id?: string;
      description?: string;
      contextValue?: string;
      command?: any;
      iconPath?: any;
      tooltip?: string;
      constructor(
        public label: string,
        public collapsibleState = 0
      ) {}
    },
    TreeItemCollapsibleState: {None: 0, Collapsed: 1, Expanded: 2},
    ThemeIcon: class MockThemeIcon {
      constructor(public id: string) {}
    },
    EventEmitter: class MockEventEmitter {
      event = jest.fn();
      fire = jest.fn();
    },
    Uri: {
      file: (p: string) => ({
        scheme: 'file',
        fsPath: p,
        path: p,
        toString: () => `file://${p}`,
      }),
      parse: (s: string) => ({scheme: 'file', fsPath: s, toString: () => s}),
      joinPath: (base: any, ...segments: string[]) => {
        // Resolve '..' segments to mimic real Uri.joinPath
        const parts = (base.fsPath || base.path).split('/');
        for (const seg of segments) {
          if (seg === '..') {
            parts.pop();
          } else {
            parts.push(seg);
          }
        }
        const resolved = parts.join('/');
        return {
          scheme: 'file',
          fsPath: resolved,
          path: resolved,
          toString: () => `file://${resolved}`,
        };
      },
    },
    Disposable: {
      from: (..._disposables: any[]) => ({dispose: jest.fn()}),
    },
    workspace: {
      fs: {readFile: mockReadFile},
      getConfiguration: mockGetConfiguration,
      asRelativePath: mockAsRelativePath,
      createFileSystemWatcher: mockCreateFileSystemWatcher,
      getWorkspaceFolder: mockGetWorkspaceFolder,
    },
    window: {
      get activeTextEditor() {
        return mockActiveTextEditor;
      },
      onDidChangeActiveTextEditor: mockOnDidChangeActiveTextEditor,
    },
  }),
  {virtual: true}
);

jest.mock('../../src/extension/logger', () => ({
  malloyLog: {appendLine: jest.fn()},
}));

import {
  ConnectionsProvider,
  ConnectionGroupItem,
  ConnectionItem,
} from '../../src/extension/tree_views/connections_view';
import {ConnectionConfigManager} from '../../src/common/types/connection_manager_types';

jest.mock('@malloydata/malloy', () => ({
  MalloyConfig: class {
    connectionMap: Record<string, unknown> | undefined;
    constructor(text: string) {
      const parsed = JSON.parse(text);
      this.connectionMap = parsed.connections;
    }
  },
}));

function makeMockConfigManager(
  overrides: Partial<ConnectionConfigManager> = {}
): ConnectionConfigManager {
  return {
    getConnectionsConfig: jest.fn().mockReturnValue(undefined),
    onConfigurationUpdated: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

function makeMockContext(): any {
  return {
    subscriptions: [],
    extensionUri: {toString: () => 'file:///ext'},
    globalState: {get: jest.fn(), update: jest.fn()},
  };
}

const ALL_TYPES = [
  'duckdb',
  'bigquery',
  'postgres',
  'snowflake',
  'trino',
  'presto',
  'mysql',
];
const ALL_DISPLAY_NAMES: Record<string, string> = {
  duckdb: 'DuckDB',
  bigquery: 'BigQuery',
  postgres: 'PostgreSQL',
  snowflake: 'Snowflake',
  trino: 'Trino',
  presto: 'Presto',
  mysql: 'MySQL',
};

/** Default connections map: same name→type for each type, plus md→duckdb. */
function buildDefaultConnections(types: string[]): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const t of types) {
    defaults[t] = t;
  }
  defaults['md'] = 'duckdb';
  return defaults;
}

const ALL_DEFAULT_CONNECTIONS = buildDefaultConnections(ALL_TYPES);

function setupMalloyConfig(values: Record<string, any> = {}): void {
  mockGetConfiguration.mockReturnValue({
    get: (key: string) => values[key],
  });
}

function injectTypes(
  provider: ConnectionsProvider,
  types = ALL_TYPES,
  displayNames = ALL_DISPLAY_NAMES,
  defaultConnections = ALL_DEFAULT_CONNECTIONS
): void {
  provider.setRegisteredTypes(types, displayNames, defaultConnections);
}

/**
 * Set up a workspace folder with an optional config file.
 * @param workspaceRoot — workspace root path
 * @param configJson — config contents (undefined = no config anywhere)
 * @param filePath — path to the active file (defaults to workspaceRoot/test.malloy)
 * @param configDir — directory containing the config (defaults to workspaceRoot)
 */
function setupWorkspaceWithConfig(
  workspaceRoot: string,
  configJson?: string,
  filePath?: string,
  configDir?: string
): void {
  const folder = {
    uri: {
      scheme: 'file',
      fsPath: workspaceRoot,
      path: workspaceRoot,
      toString: () => `file://${workspaceRoot}`,
    },
  };
  const activeFilePath = filePath ?? `${workspaceRoot}/test.malloy`;
  mockActiveTextEditor = {
    document: {
      uri: {
        scheme: 'file',
        fsPath: activeFilePath,
        path: activeFilePath,
        toString: () => `file://${activeFilePath}`,
      },
    },
  };
  mockGetWorkspaceFolder.mockReturnValue(folder);

  if (configJson) {
    const expectedConfigDir = configDir ?? workspaceRoot;
    mockReadFile.mockImplementation((uri: any) => {
      const uriPath = uri.fsPath ?? uri.path ?? '';
      if (uriPath === `${expectedConfigDir}/malloy-config.json`) {
        return Promise.resolve(new TextEncoder().encode(configJson));
      }
      return Promise.reject(new Error('File not found'));
    });
  } else {
    mockReadFile.mockRejectedValue(new Error('File not found'));
  }
}

function clearActiveEditor(): void {
  mockActiveTextEditor = undefined;
  mockGetWorkspaceFolder.mockReturnValue(undefined);
  mockReadFile.mockRejectedValue(new Error('File not found'));
}

describe('ConnectionsProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearActiveEditor();
    setupMalloyConfig({});
  });

  describe('settings only (no config files)', () => {
    it('shows settings group when connectionMap has entries', async () => {
      const manager = makeMockConfigManager({
        getConnectionsConfig: jest.fn().mockReturnValue({
          mydb: {is: 'duckdb'},
          warehouse: {is: 'bigquery', projectId: 'proj'},
        }),
      });

      const provider = new ConnectionsProvider(makeMockContext(), manager);
      injectTypes(provider);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const settingsGroup = groups.find(
        g => g.contextValue === 'connectionGroup.settings'
      );
      expect(settingsGroup).toBeDefined();
      expect(settingsGroup!.label).toBe('Settings');

      const children = settingsGroup!.children;
      expect(children).toHaveLength(2);
      expect(children[0].label).toBe('mydb');
      expect(children[0].description).toBe('(DuckDB)');
      expect(children[0].contextValue).toBe('connection.settings');
      expect(children[1].label).toBe('warehouse');
      expect(children[1].description).toBe('(BigQuery)');
    });

    it('shows defaults group with unoverridden registered types', async () => {
      const manager = makeMockConfigManager({
        getConnectionsConfig: jest.fn().mockReturnValue({
          duckdb: {is: 'duckdb'},
          bigquery: {is: 'bigquery'},
        }),
      });

      const provider = new ConnectionsProvider(makeMockContext(), manager);
      injectTypes(provider);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const defaultsGroup = groups.find(
        g => g.contextValue === 'connectionGroup.defaults'
      );
      expect(defaultsGroup).toBeDefined();
      expect(defaultsGroup!.label).toBe('Defaults');

      const names = defaultsGroup!.children.map(c => c.label);
      expect(names).toContain('postgres');
      expect(names).toContain('trino');
      expect(names).not.toContain('duckdb');
      expect(names).not.toContain('bigquery');
    });

    it('hides defaults group when all types are overridden', async () => {
      const manager = makeMockConfigManager({
        getConnectionsConfig: jest.fn().mockReturnValue({
          duckdb: {is: 'duckdb'},
          bigquery: {is: 'bigquery'},
          md: {is: 'duckdb', databasePath: 'md:'},
        }),
      });

      const provider = new ConnectionsProvider(makeMockContext(), manager);
      injectTypes(
        provider,
        ['duckdb', 'bigquery'],
        ALL_DISPLAY_NAMES,
        buildDefaultConnections(['duckdb', 'bigquery'])
      );
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const defaultsGroup = groups.find(
        g => g.contextValue === 'connectionGroup.defaults'
      );
      expect(defaultsGroup).toBeUndefined();
    });

    it('hides settings group when no settings connections exist', async () => {
      const manager = makeMockConfigManager({
        getConnectionsConfig: jest.fn().mockReturnValue({}),
      });

      const provider = new ConnectionsProvider(makeMockContext(), manager);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const settingsGroup = groups.find(
        g => g.contextValue === 'connectionGroup.settings'
      );
      expect(settingsGroup).toBeUndefined();
    });
  });

  describe('config file connections', () => {
    it('shows config group when config file exists for active file', async () => {
      setupWorkspaceWithConfig(
        '/workspace',
        JSON.stringify({
          connections: {
            mydb: {is: 'duckdb'},
            analytics: {is: 'bigquery'},
          },
        })
      );
      mockAsRelativePath.mockReturnValue('malloy-config.json');

      const manager = makeMockConfigManager();
      const provider = new ConnectionsProvider(makeMockContext(), manager);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const configGroup = groups.find(
        g => g.contextValue === 'connectionGroup.config'
      );
      expect(configGroup).toBeDefined();
      expect(configGroup!.label).toBe('Config: malloy-config.json');

      const children = configGroup!.children;
      expect(children).toHaveLength(2);
      expect(children[0].label).toBe('mydb');
      expect(children[0].contextValue).toBe('connection.config');
      expect(children[1].label).toBe('analytics');
    });

    it('config connection click opens the readonly editor', async () => {
      setupWorkspaceWithConfig(
        '/workspace',
        JSON.stringify({connections: {mydb: {is: 'duckdb'}}})
      );

      const manager = makeMockConfigManager();
      const provider = new ConnectionsProvider(makeMockContext(), manager);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const configGroup = groups.find(
        g => g.contextValue === 'connectionGroup.config'
      )!;
      const child = configGroup.children[0];
      expect(child.command).toBeDefined();
      expect(child.command!.command).toBe('malloy.viewConfigConnection');
    });

    it('handles config file parse errors gracefully', async () => {
      setupWorkspaceWithConfig('/workspace', 'invalid json {{{');

      const manager = makeMockConfigManager();
      const provider = new ConnectionsProvider(makeMockContext(), manager);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const configGroup = groups.find(
        g => g.contextValue === 'connectionGroup.config'
      );
      expect(configGroup).toBeUndefined();
    });

    it('finds config in intermediate directory via walk-up', async () => {
      setupWorkspaceWithConfig(
        '/workspace',
        JSON.stringify({connections: {mydb: {is: 'duckdb'}}}),
        '/workspace/src/models/test.malloy',
        '/workspace/src'
      );
      mockAsRelativePath.mockReturnValue('src/malloy-config.json');

      const manager = makeMockConfigManager();
      const provider = new ConnectionsProvider(makeMockContext(), manager);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const configGroup = groups.find(
        g => g.contextValue === 'connectionGroup.config'
      );
      expect(configGroup).toBeDefined();
      expect(configGroup!.children).toHaveLength(1);
      expect(configGroup!.children[0].label).toBe('mydb');
    });

    it('shows no config group when no file is open', async () => {
      clearActiveEditor();

      const manager = makeMockConfigManager();
      const provider = new ConnectionsProvider(makeMockContext(), manager);
      injectTypes(provider);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const configGroup = groups.find(
        g => g.contextValue === 'connectionGroup.config'
      );
      expect(configGroup).toBeUndefined();
    });
  });

  describe('shadowing', () => {
    it('settings connection shows (shadowed) when config has same name', async () => {
      setupWorkspaceWithConfig(
        '/workspace',
        JSON.stringify({connections: {mydb: {is: 'duckdb'}}})
      );

      const manager = makeMockConfigManager({
        getConnectionsConfig: jest.fn().mockReturnValue({
          mydb: {is: 'duckdb'},
          other: {is: 'postgres'},
        }),
      });

      const provider = new ConnectionsProvider(makeMockContext(), manager);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const settingsGroup = groups.find(
        g => g.contextValue === 'connectionGroup.settings'
      )!;
      const mydbItem = settingsGroup.children.find(c => c.label === 'mydb')!;
      expect(mydbItem.description).toContain('(shadowed)');

      const otherItem = settingsGroup.children.find(c => c.label === 'other')!;
      expect(otherItem.description).not.toContain('(shadowed)');
    });

    it('config connection names hide defaults', async () => {
      setupWorkspaceWithConfig(
        '/workspace',
        JSON.stringify({connections: {duckdb: {is: 'duckdb'}}})
      );

      const manager = makeMockConfigManager();
      const provider = new ConnectionsProvider(makeMockContext(), manager);
      injectTypes(provider);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const defaultsGroup = groups.find(
        g => g.contextValue === 'connectionGroup.defaults'
      );
      if (defaultsGroup) {
        const names = defaultsGroup.children.map(c => c.label);
        expect(names).not.toContain('duckdb');
      }
    });
  });

  describe('projectConnectionsOnly', () => {
    it('hides settings and defaults when projectConnectionsOnly is true', async () => {
      setupMalloyConfig({projectConnectionsOnly: true});
      setupWorkspaceWithConfig(
        '/workspace',
        JSON.stringify({connections: {mydb: {is: 'duckdb'}}})
      );

      const manager = makeMockConfigManager({
        getConnectionsConfig: jest.fn().mockReturnValue({
          other: {is: 'postgres'},
        }),
      });

      const provider = new ConnectionsProvider(makeMockContext(), manager);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      expect(groups).toHaveLength(1);
      expect(groups[0].contextValue).toBe('connectionGroup.config');
    });

    it('returns empty when projectConnectionsOnly and no config files', async () => {
      setupMalloyConfig({projectConnectionsOnly: true});
      clearActiveEditor();

      const manager = makeMockConfigManager({
        getConnectionsConfig: jest.fn().mockReturnValue({
          mydb: {is: 'duckdb'},
        }),
      });

      const provider = new ConnectionsProvider(makeMockContext(), manager);
      const groups = await provider.getChildren();

      expect(groups).toHaveLength(0);
    });
  });

  describe('getChildren for child items', () => {
    it('returns children for a group item', async () => {
      const manager = makeMockConfigManager({
        getConnectionsConfig: jest.fn().mockReturnValue({
          mydb: {is: 'duckdb'},
        }),
      });

      const provider = new ConnectionsProvider(makeMockContext(), manager);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];
      const settingsGroup = groups.find(
        g => g.contextValue === 'connectionGroup.settings'
      )!;

      const children = await provider.getChildren(settingsGroup);
      expect(children).toHaveLength(1);
      expect((children[0] as ConnectionItem).label).toBe('mydb');
    });

    it('returns empty array for a connection item', async () => {
      const item = ConnectionItem.settings('test', 'DuckDB');
      const manager = makeMockConfigManager();
      const provider = new ConnectionsProvider(makeMockContext(), manager);
      const children = await provider.getChildren(item);
      expect(children).toHaveLength(0);
    });
  });

  describe('default connection items', () => {
    it('default items have createConnection command', async () => {
      const manager = makeMockConfigManager();
      const provider = new ConnectionsProvider(makeMockContext(), manager);
      injectTypes(provider);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const defaultsGroup = groups.find(
        g => g.contextValue === 'connectionGroup.defaults'
      )!;
      for (const child of defaultsGroup.children) {
        expect(child.command).toBeDefined();
        expect(child.command!.command).toBe('malloy.createConnection');
        expect(child.contextValue).toBe('connection.defaults');
      }
    });

    it('settings items have editConnections command', async () => {
      const manager = makeMockConfigManager({
        getConnectionsConfig: jest.fn().mockReturnValue({
          mydb: {is: 'duckdb'},
        }),
      });

      const provider = new ConnectionsProvider(makeMockContext(), manager);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const settingsGroup = groups.find(
        g => g.contextValue === 'connectionGroup.settings'
      )!;
      expect(settingsGroup.children[0].command!.command).toBe(
        'malloy.editConnections'
      );
    });
  });

  describe('config group header', () => {
    it('stores configFileUri on config group for open action', async () => {
      setupWorkspaceWithConfig(
        '/workspace',
        JSON.stringify({connections: {mydb: {is: 'duckdb'}}})
      );

      const manager = makeMockConfigManager();
      const provider = new ConnectionsProvider(makeMockContext(), manager);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const configGroup = groups.find(
        g => g.contextValue === 'connectionGroup.config'
      )!;
      expect(configGroup.configFileUri).toBeDefined();
      expect(configGroup.configFileUri).toContain('malloy-config.json');
    });
  });
});

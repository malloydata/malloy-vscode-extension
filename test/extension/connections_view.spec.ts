/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockFindFiles = jest.fn().mockResolvedValue([]);
const mockReadFile = jest.fn();
const mockGetConfiguration = jest.fn();
const mockAsRelativePath = jest.fn((uri: any) => uri.fsPath ?? uri.toString());
const mockCreateFileSystemWatcher = jest.fn(() => ({
  onDidCreate: jest.fn(() => ({dispose: jest.fn()})),
  onDidChange: jest.fn(() => ({dispose: jest.fn()})),
  onDidDelete: jest.fn(() => ({dispose: jest.fn()})),
  dispose: jest.fn(),
}));

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
      file: (path: string) => ({
        scheme: 'file',
        fsPath: path,
        toString: () => `file://${path}`,
      }),
      parse: (s: string) => ({scheme: 'file', fsPath: s, toString: () => s}),
    },
    Disposable: {
      from: (..._disposables: any[]) => ({dispose: jest.fn()}),
    },
    workspace: {
      findFiles: mockFindFiles,
      fs: {readFile: mockReadFile},
      getConfiguration: mockGetConfiguration,
      asRelativePath: mockAsRelativePath,
      createFileSystemWatcher: mockCreateFileSystemWatcher,
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
  readConnectionsConfig: (text: string) => JSON.parse(text),
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

function setupMalloyConfig(values: Record<string, any> = {}): void {
  mockGetConfiguration.mockReturnValue({
    get: (key: string) => values[key],
  });
}

function injectTypes(
  provider: ConnectionsProvider,
  types = ALL_TYPES,
  displayNames = ALL_DISPLAY_NAMES
): void {
  provider.setRegisteredTypes(types, displayNames);
}

describe('ConnectionsProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFiles.mockResolvedValue([]);
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
        }),
      });

      const provider = new ConnectionsProvider(makeMockContext(), manager);
      injectTypes(provider, ['duckdb', 'bigquery'], ALL_DISPLAY_NAMES);
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
    it('shows config group when config file exists', async () => {
      const configUri = {
        scheme: 'file',
        fsPath: '/workspace/malloy-config.json',
        toString: () => 'file:///workspace/malloy-config.json',
      };
      mockFindFiles.mockResolvedValue([configUri]);
      mockReadFile.mockResolvedValue(
        new TextEncoder().encode(
          JSON.stringify({
            connections: {
              mydb: {is: 'duckdb'},
              analytics: {is: 'bigquery'},
            },
          })
        )
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
      const configUri = {
        scheme: 'file',
        fsPath: '/workspace/malloy-config.json',
        toString: () => 'file:///workspace/malloy-config.json',
      };
      mockFindFiles.mockResolvedValue([configUri]);
      mockReadFile.mockResolvedValue(
        new TextEncoder().encode(
          JSON.stringify({connections: {mydb: {is: 'duckdb'}}})
        )
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
      const configUri = {
        scheme: 'file',
        fsPath: '/workspace/malloy-config.json',
        toString: () => 'file:///workspace/malloy-config.json',
      };
      mockFindFiles.mockResolvedValue([configUri]);
      mockReadFile.mockResolvedValue(
        new TextEncoder().encode('invalid json {{{')
      );

      const manager = makeMockConfigManager();
      const provider = new ConnectionsProvider(makeMockContext(), manager);
      const groups = (await provider.getChildren()) as ConnectionGroupItem[];

      const configGroup = groups.find(
        g => g.contextValue === 'connectionGroup.config'
      );
      expect(configGroup).toBeUndefined();
    });
  });

  describe('shadowing', () => {
    it('settings connection shows (shadowed) when config has same name', async () => {
      const configUri = {
        scheme: 'file',
        fsPath: '/workspace/malloy-config.json',
        toString: () => 'file:///workspace/malloy-config.json',
      };
      mockFindFiles.mockResolvedValue([configUri]);
      mockReadFile.mockResolvedValue(
        new TextEncoder().encode(
          JSON.stringify({connections: {mydb: {is: 'duckdb'}}})
        )
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
      const configUri = {
        scheme: 'file',
        fsPath: '/workspace/malloy-config.json',
        toString: () => 'file:///workspace/malloy-config.json',
      };
      mockFindFiles.mockResolvedValue([configUri]);
      mockReadFile.mockResolvedValue(
        new TextEncoder().encode(
          JSON.stringify({connections: {duckdb: {is: 'duckdb'}}})
        )
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

      const configUri = {
        scheme: 'file',
        fsPath: '/workspace/malloy-config.json',
        toString: () => 'file:///workspace/malloy-config.json',
      };
      mockFindFiles.mockResolvedValue([configUri]);
      mockReadFile.mockResolvedValue(
        new TextEncoder().encode(
          JSON.stringify({connections: {mydb: {is: 'duckdb'}}})
        )
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
});

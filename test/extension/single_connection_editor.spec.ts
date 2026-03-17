/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockSecrets = {
  store: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  delete: jest.fn().mockResolvedValue(undefined),
};

let mockConnectionMap: Record<string, any> = {};
const mockUpdate = jest.fn();
const mockShowErrorMessage = jest.fn();
const mockShowOpenDialog = jest.fn();

jest.mock(
  'vscode',
  () => ({
    window: {
      createWebviewPanel: () => ({
        webview: {html: ''},
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn(),
      }),
      showOpenDialog: mockShowOpenDialog,
      showErrorMessage: mockShowErrorMessage,
    },
    ViewColumn: {One: 1},
    ConfigurationTarget: {Global: 1},
    Uri: {
      file: (p: string) => ({fsPath: p, toString: () => `file://${p}`}),
    },
  }),
  {virtual: true}
);

jest.mock('../../src/extension/webviews/webview_html', () => ({
  getWebviewHtml: () => '<html></html>',
}));

jest.mock('../../src/extension/webview_message_manager', () => ({
  WebviewMessageManager: class {
    postMessage = jest.fn();
    onReceiveMessage = jest.fn();
  },
}));

jest.mock('uuid', () => ({v1: () => 'test-uuid'}));

jest.mock('../../src/extension/utils/config', () => ({
  getMalloyConfig: () => ({
    get: (key: string) => {
      if (key === 'connectionMap') return {...mockConnectionMap};
      return undefined;
    },
    update: mockUpdate.mockImplementation(
      (_key: string, value: any, _target: any) => {
        mockConnectionMap = value;
        return Promise.resolve();
      }
    ),
  }),
}));

import {SingleConnectionPanel} from '../../src/extension/single_connection_editor';
import {
  SingleConnectionMessageType,
  ConnectionTestStatus,
  ConnectionServiceFileRequestStatus,
} from '../../src/common/types/message_types';

// Trino-like properties with JSON fields
const trinoProperties = [
  {name: 'server', displayName: 'Server', type: 'string', optional: true},
  {name: 'port', displayName: 'Port', type: 'number', optional: true},
  {name: 'user', displayName: 'User', type: 'string', optional: true},
  {
    name: 'ssl',
    displayName: 'SSL',
    type: 'json',
    optional: true,
    description: 'TLS/SSL configuration',
  },
  {
    name: 'session',
    displayName: 'Session',
    type: 'json',
    optional: true,
    description: 'Session properties',
  },
  {
    name: 'extraHeaders',
    displayName: 'Extra Headers',
    type: 'json',
    optional: true,
    description: 'Additional HTTP headers',
  },
  {
    name: 'password',
    displayName: 'Password',
    type: 'password',
    optional: true,
  },
  {
    name: 'setupSQL',
    displayName: 'Setup SQL',
    type: 'text',
    optional: true,
  },
];

const mockTypeInfo = {
  registeredTypes: ['trino', 'duckdb'],
  typeDisplayNames: {trino: 'Trino', duckdb: 'DuckDB'},
  typeProperties: {trino: trinoProperties},
  defaultConnections: {trino: 'trino', duckdb: 'duckdb', md: 'duckdb'},
};

function makePanel(): SingleConnectionPanel {
  const mockWorker = {
    sendRequest: jest.fn().mockResolvedValue(mockTypeInfo),
  };

  const mockContext = {
    extensionUri: {toString: () => 'file:///ext'},
    subscriptions: [],
    secrets: mockSecrets,
  };

  return new SingleConnectionPanel(mockContext as any, mockWorker as any);
}

/**
 * Send a message to the panel's handleMessage directly,
 * awaiting the full async chain (the onReceiveMessage wrapper
 * is fire-and-forget, so we bypass it).
 */
async function sendMessage(
  panel: SingleConnectionPanel,
  msg: any
): Promise<void> {
  await (panel as any).handleMessage(msg);
}

/** Get the mock message manager from a panel */
function getMessages(panel: SingleConnectionPanel) {
  return (panel as any).messageManager;
}

describe('SingleConnectionPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectionMap = {};
  });

  describe('editConnection', () => {
    it('loads string and number values from settings', async () => {
      mockConnectionMap = {
        my_trino: {is: 'trino', server: 'http://localhost', port: 8080},
      };
      const panel = makePanel();
      await panel.editConnection('my_trino');

      const loadMsg = getMessages(panel).postMessage.mock.calls[0][0];
      expect(loadMsg.type).toBe(SingleConnectionMessageType.LoadConnection);
      expect(loadMsg.name).toBe('my_trino');
      expect(loadMsg.typeName).toBe('trino');
      expect(loadMsg.values.server).toBe('http://localhost');
      expect(loadMsg.values.port).toBe(8080);
      expect(loadMsg.isNew).toBe(false);
    });

    it('stringifies object values for display in webview', async () => {
      mockConnectionMap = {
        my_trino: {
          is: 'trino',
          server: 'http://localhost',
          ssl: {rejectUnauthorized: false},
          session: {query_max_run_time: '10m'},
        },
      };
      const panel = makePanel();
      await panel.editConnection('my_trino');

      const loadMsg = getMessages(panel).postMessage.mock.calls[0][0];
      expect(loadMsg.values.ssl).toBe('{"rejectUnauthorized":false}');
      expect(loadMsg.values.session).toBe('{"query_max_run_time":"10m"}');
      expect(loadMsg.values.server).toBe('http://localhost');
    });

    it('resolves secret values from keychain', async () => {
      mockConnectionMap = {
        my_trino: {
          is: 'trino',
          server: 'http://localhost',
          password: {secretKey: 'connections.some-uuid.password'},
        },
      };
      mockSecrets.get.mockResolvedValueOnce('s3cret');

      const panel = makePanel();
      await panel.editConnection('my_trino');

      expect(mockSecrets.get).toHaveBeenCalledWith(
        'connections.some-uuid.password'
      );
      const loadMsg = getMessages(panel).postMessage.mock.calls[0][0];
      expect(loadMsg.values.password).toBe('s3cret');
    });

    it('omits secret values when keychain returns undefined', async () => {
      mockConnectionMap = {
        my_trino: {
          is: 'trino',
          password: {secretKey: 'connections.some-uuid.password'},
        },
      };
      mockSecrets.get.mockResolvedValueOnce(undefined);

      const panel = makePanel();
      await panel.editConnection('my_trino');

      const loadMsg = getMessages(panel).postMessage.mock.calls[0][0];
      expect(loadMsg.values.password).toBeUndefined();
    });

    it('shows error message for missing connection', async () => {
      mockConnectionMap = {};
      const panel = makePanel();
      await panel.editConnection('nonexistent');

      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        'Connection "nonexistent" not found in settings.'
      );
    });

    it('extracts UUID from existing secretKey references', async () => {
      mockConnectionMap = {
        my_trino: {
          is: 'trino',
          password: {secretKey: 'connections.existing-uuid-123.password'},
        },
      };
      mockSecrets.get.mockResolvedValueOnce('pw');

      const panel = makePanel();
      await panel.editConnection('my_trino');

      const loadMsg = getMessages(panel).postMessage.mock.calls[0][0];
      expect(loadMsg.uuid).toBe('existing-uuid-123');
    });

    it('generates new UUID when no secretKey references exist', async () => {
      mockConnectionMap = {
        my_trino: {is: 'trino', server: 'http://localhost'},
      };
      const panel = makePanel();
      await panel.editConnection('my_trino');

      const loadMsg = getMessages(panel).postMessage.mock.calls[0][0];
      expect(loadMsg.uuid).toBe('test-uuid');
    });

    it('sends existing connection names excluding current', async () => {
      mockConnectionMap = {
        my_trino: {is: 'trino'},
        other_conn: {is: 'duckdb'},
        third: {is: 'trino'},
      };
      const panel = makePanel();
      await panel.editConnection('my_trino');

      const loadMsg = getMessages(panel).postMessage.mock.calls[0][0];
      expect(loadMsg.existingNames).toEqual(
        expect.arrayContaining(['other_conn', 'third'])
      );
      expect(loadMsg.existingNames).not.toContain('my_trino');
    });
  });

  describe('createConnection', () => {
    it('sends empty values with isNew flag', async () => {
      const panel = makePanel();
      await panel.createConnection('trino');

      const loadMsg = getMessages(panel).postMessage.mock.calls[0][0];
      expect(loadMsg.type).toBe(SingleConnectionMessageType.LoadConnection);
      expect(loadMsg.typeName).toBe('trino');
      expect(loadMsg.typeDisplayName).toBe('Trino');
      expect(loadMsg.values).toEqual({});
      expect(loadMsg.isNew).toBe(true);
      expect(loadMsg.uuid).toBe('test-uuid');
    });

    it('sends all existing names for duplicate detection', async () => {
      mockConnectionMap = {
        conn_a: {is: 'trino'},
        conn_b: {is: 'duckdb'},
      };
      const panel = makePanel();
      await panel.createConnection('trino');

      const loadMsg = getMessages(panel).postMessage.mock.calls[0][0];
      expect(loadMsg.existingNames).toEqual(
        expect.arrayContaining(['conn_a', 'conn_b'])
      );
    });
  });

  describe('viewConfigConnection', () => {
    it('stringifies object values for display in webview', async () => {
      const panel = makePanel();
      await panel.viewConfigConnection(
        'my_trino',
        {
          is: 'trino',
          server: 'http://localhost',
          ssl: {rejectUnauthorized: false},
          extraHeaders: {Authorization: 'Bearer token'},
        },
        'file:///config/malloy-config.json'
      );

      const loadMsg = getMessages(panel).postMessage.mock.calls[0][0];
      expect(loadMsg.type).toBe(SingleConnectionMessageType.LoadConnection);
      expect(loadMsg.values.ssl).toBe('{"rejectUnauthorized":false}');
      expect(loadMsg.values.extraHeaders).toBe(
        '{"Authorization":"Bearer token"}'
      );
      expect(loadMsg.values.server).toBe('http://localhost');
    });

    it('sends readonly flag', async () => {
      const panel = makePanel();
      await panel.viewConfigConnection(
        'cfg_trino',
        {is: 'trino', server: 'http://localhost'},
        'file:///config/malloy-config.json'
      );

      const loadMsg = getMessages(panel).postMessage.mock.calls[0][0];
      expect(loadMsg.readonly).toBe(true);
    });

    it('resolves {env} value references', async () => {
      process.env['TEST_TRINO_SERVER'] = 'http://trino.example.com';
      try {
        const panel = makePanel();
        await panel.viewConfigConnection(
          'cfg_trino',
          {
            is: 'trino',
            server: {env: 'TEST_TRINO_SERVER'} as any,
          },
          'file:///config/malloy-config.json'
        );

        const loadMsg = getMessages(panel).postMessage.mock.calls[0][0];
        expect(loadMsg.values.server).toBe('http://trino.example.com');
      } finally {
        delete process.env['TEST_TRINO_SERVER'];
      }
    });
  });

  describe('handleSave', () => {
    it('parses JSON string values into objects when saving', async () => {
      mockConnectionMap = {
        my_trino: {is: 'trino', server: 'http://localhost'},
      };
      const panel = makePanel();
      await panel.editConnection('my_trino');

      await sendMessage(panel, {
        type: SingleConnectionMessageType.SaveConnection,
        originalName: 'my_trino',
        name: 'my_trino',
        values: {
          server: 'http://localhost',
          port: 8080,
          ssl: '{"rejectUnauthorized": false}',
          session: '{"query_max_run_time": "10m"}',
          extraHeaders: '{}',
        },
      });

      const savedMap = mockUpdate.mock.calls[0][1];
      const saved = savedMap['my_trino'];
      expect(saved.ssl).toEqual({rejectUnauthorized: false});
      expect(saved.session).toEqual({query_max_run_time: '10m'});
      expect(saved.extraHeaders).toEqual({});
      expect(saved.server).toBe('http://localhost');
      expect(saved.port).toBe(8080);
    });

    it('preserves string value when JSON parse fails', async () => {
      mockConnectionMap = {my_trino: {is: 'trino'}};
      const panel = makePanel();
      await panel.editConnection('my_trino');

      await sendMessage(panel, {
        type: SingleConnectionMessageType.SaveConnection,
        originalName: 'my_trino',
        name: 'my_trino',
        values: {ssl: 'not valid json{'},
      });

      const savedMap = mockUpdate.mock.calls[0][1];
      expect(savedMap['my_trino'].ssl).toBe('not valid json{');
    });

    it('does not parse text-typed fields as JSON', async () => {
      mockConnectionMap = {my_trino: {is: 'trino'}};
      const panel = makePanel();
      await panel.editConnection('my_trino');

      await sendMessage(panel, {
        type: SingleConnectionMessageType.SaveConnection,
        originalName: 'my_trino',
        name: 'my_trino',
        values: {setupSQL: 'SET search_path TO public;'},
      });

      const savedMap = mockUpdate.mock.calls[0][1];
      expect(savedMap['my_trino'].setupSQL).toBe('SET search_path TO public;');
    });

    it('skips empty and undefined values', async () => {
      mockConnectionMap = {my_trino: {is: 'trino'}};
      const panel = makePanel();
      await panel.editConnection('my_trino');

      await sendMessage(panel, {
        type: SingleConnectionMessageType.SaveConnection,
        originalName: 'my_trino',
        name: 'my_trino',
        values: {server: 'http://localhost', user: '', port: undefined as any},
      });

      const saved = mockUpdate.mock.calls[0][1]['my_trino'];
      expect(saved.server).toBe('http://localhost');
      expect(saved).not.toHaveProperty('user');
      expect(saved).not.toHaveProperty('port');
    });

    it('stores password values in keychain with secretKey reference', async () => {
      mockConnectionMap = {my_trino: {is: 'trino'}};
      const panel = makePanel();
      await panel.editConnection('my_trino');

      await sendMessage(panel, {
        type: SingleConnectionMessageType.SaveConnection,
        originalName: 'my_trino',
        name: 'my_trino',
        values: {password: 'my-secret-pw'},
      });

      expect(mockSecrets.store).toHaveBeenCalledWith(
        expect.stringMatching(/^connections\..+\.password$/),
        'my-secret-pw'
      );
      const saved = mockUpdate.mock.calls[0][1]['my_trino'];
      expect(saved.password).toEqual({
        secretKey: expect.stringMatching(/^connections\..+\.password$/),
      });
      // Password should NOT be stored as plaintext in settings
      expect(typeof saved.password).not.toBe('string');
    });

    it('parses JSON arrays correctly', async () => {
      mockConnectionMap = {my_trino: {is: 'trino'}};
      const panel = makePanel();
      await panel.editConnection('my_trino');

      await sendMessage(panel, {
        type: SingleConnectionMessageType.SaveConnection,
        originalName: 'my_trino',
        name: 'my_trino',
        values: {ssl: '[{"host": "a"}, {"host": "b"}]'},
      });

      const saved = mockUpdate.mock.calls[0][1]['my_trino'];
      expect(saved.ssl).toEqual([{host: 'a'}, {host: 'b'}]);
    });

    it('round-trips JSON values through save and edit', async () => {
      // Save a connection with JSON values
      mockConnectionMap = {my_trino: {is: 'trino'}};
      const panel1 = makePanel();
      await panel1.editConnection('my_trino');

      await sendMessage(panel1, {
        type: SingleConnectionMessageType.SaveConnection,
        originalName: 'my_trino',
        name: 'my_trino',
        values: {
          server: 'http://localhost',
          ssl: '{"rejectUnauthorized": false}',
          session: '{"query_max_run_time": "10m"}',
        },
      });

      // Now re-edit the saved connection — objects should load as strings
      const panel2 = makePanel();
      await panel2.editConnection('my_trino');

      const loadMsg = getMessages(panel2).postMessage.mock.calls[0][0];
      expect(loadMsg.values.ssl).toBe('{"rejectUnauthorized":false}');
      expect(loadMsg.values.session).toBe('{"query_max_run_time":"10m"}');
      expect(loadMsg.values.server).toBe('http://localhost');
    });

    it('renames connection when name changes', async () => {
      mockConnectionMap = {
        old_name: {is: 'trino', server: 'http://localhost'},
      };
      const panel = makePanel();
      await panel.editConnection('old_name');

      await sendMessage(panel, {
        type: SingleConnectionMessageType.SaveConnection,
        originalName: 'old_name',
        name: 'new_name',
        values: {server: 'http://localhost'},
      });

      const savedMap = mockUpdate.mock.calls[0][1];
      expect(savedMap).not.toHaveProperty('old_name');
      expect(savedMap['new_name']).toBeDefined();
      expect(savedMap['new_name'].server).toBe('http://localhost');
    });
  });

  describe('handleTest', () => {
    it('parses JSON string values before sending to worker', async () => {
      mockConnectionMap = {my_trino: {is: 'trino'}};
      const panel = makePanel();
      await panel.editConnection('my_trino');

      const worker = (panel as any).worker;
      worker.sendRequest.mockResolvedValueOnce('');

      await sendMessage(panel, {
        type: SingleConnectionMessageType.TestConnection,
        status: 'waiting',
        name: 'my_trino',
        values: {
          server: 'http://localhost',
          session: '{"query_max_run_time": "10m"}',
          ssl: '{"rejectUnauthorized": false}',
        },
      });

      const testCall = worker.sendRequest.mock.calls.find(
        (c: any[]) => c[0] === 'malloy/testConnectionEntry'
      );
      expect(testCall).toBeDefined();
      const entry = testCall[1].entry;
      expect(entry.session).toEqual({query_max_run_time: '10m'});
      expect(entry.ssl).toEqual({rejectUnauthorized: false});
      expect(entry.server).toBe('http://localhost');
    });

    it('posts success status on successful test', async () => {
      mockConnectionMap = {my_trino: {is: 'trino'}};
      const panel = makePanel();
      await panel.editConnection('my_trino');

      const worker = (panel as any).worker;
      worker.sendRequest.mockResolvedValueOnce('');

      await sendMessage(panel, {
        type: SingleConnectionMessageType.TestConnection,
        status: 'waiting',
        name: 'my_trino',
        values: {server: 'http://localhost'},
      });

      const messages = getMessages(panel);
      const testMsg = messages.postMessage.mock.calls.find(
        (c: any[]) => c[0].type === SingleConnectionMessageType.TestConnection
      );
      expect(testMsg).toBeDefined();
      expect(testMsg[0].status).toBe(ConnectionTestStatus.Success);
    });

    it('posts error status on failed test', async () => {
      mockConnectionMap = {my_trino: {is: 'trino'}};
      const panel = makePanel();
      await panel.editConnection('my_trino');

      const worker = (panel as any).worker;
      worker.sendRequest.mockRejectedValueOnce(new Error('Connection refused'));

      await sendMessage(panel, {
        type: SingleConnectionMessageType.TestConnection,
        status: 'waiting',
        name: 'my_trino',
        values: {server: 'http://localhost'},
      });

      const messages = getMessages(panel);
      const testMsg = messages.postMessage.mock.calls.find(
        (c: any[]) => c[0].type === SingleConnectionMessageType.TestConnection
      );
      expect(testMsg).toBeDefined();
      expect(testMsg[0].status).toBe(ConnectionTestStatus.Error);
      expect(testMsg[0].error).toContain('Connection refused');
    });

    it('posts error when worker returns non-empty string', async () => {
      mockConnectionMap = {my_trino: {is: 'trino'}};
      const panel = makePanel();
      await panel.editConnection('my_trino');

      const worker = (panel as any).worker;
      worker.sendRequest.mockResolvedValueOnce('Auth failed');

      await sendMessage(panel, {
        type: SingleConnectionMessageType.TestConnection,
        status: 'waiting',
        name: 'my_trino',
        values: {server: 'http://localhost'},
      });

      const messages = getMessages(panel);
      const testMsg = messages.postMessage.mock.calls.find(
        (c: any[]) => c[0].type === SingleConnectionMessageType.TestConnection
      );
      expect(testMsg).toBeDefined();
      expect(testMsg[0].status).toBe(ConnectionTestStatus.Error);
    });
  });

  describe('handleDelete', () => {
    it('removes connection from settings', async () => {
      mockConnectionMap = {
        my_trino: {is: 'trino', server: 'http://localhost'},
        other: {is: 'duckdb'},
      };
      const panel = makePanel();
      await panel.editConnection('my_trino');

      await sendMessage(panel, {
        type: SingleConnectionMessageType.DeleteConnection,
        name: 'my_trino',
      });

      const savedMap = mockUpdate.mock.calls[0][1];
      expect(savedMap).not.toHaveProperty('my_trino');
      expect(savedMap).toHaveProperty('other');
    });

    it('cleans up keychain entries for secret-typed properties', async () => {
      mockConnectionMap = {
        my_trino: {
          is: 'trino',
          password: {secretKey: 'connections.the-uuid.password'},
        },
      };
      mockSecrets.get.mockResolvedValueOnce('pw');

      const panel = makePanel();
      await panel.editConnection('my_trino');

      await sendMessage(panel, {
        type: SingleConnectionMessageType.DeleteConnection,
        name: 'my_trino',
      });

      expect(mockSecrets.delete).toHaveBeenCalledWith(
        expect.stringMatching(/\.password$/)
      );
    });
  });

  describe('handleDuplicate', () => {
    it('generates unique copy name', async () => {
      mockConnectionMap = {my_trino: {is: 'trino'}};
      const panel = makePanel();
      await panel.editConnection('my_trino');

      await sendMessage(panel, {
        type: SingleConnectionMessageType.DuplicateConnection,
        name: 'my_trino',
        values: {server: 'http://localhost'},
      });

      const messages = getMessages(panel);
      const loadMsg = messages.postMessage.mock.calls.find(
        (c: any[]) =>
          c[0].type === SingleConnectionMessageType.LoadConnection &&
          c[0].isNew === true
      );
      expect(loadMsg).toBeDefined();
      expect(loadMsg[0].name).toBe('my_trino_copy');
      expect(loadMsg[0].isNew).toBe(true);
    });

    it('appends number when copy name already exists', async () => {
      mockConnectionMap = {
        my_trino: {is: 'trino'},
        my_trino_copy: {is: 'trino'},
      };
      const panel = makePanel();
      await panel.editConnection('my_trino');

      await sendMessage(panel, {
        type: SingleConnectionMessageType.DuplicateConnection,
        name: 'my_trino',
        values: {server: 'http://localhost'},
      });

      const messages = getMessages(panel);
      const loadMsg = messages.postMessage.mock.calls.find(
        (c: any[]) =>
          c[0].type === SingleConnectionMessageType.LoadConnection &&
          c[0].isNew === true
      );
      expect(loadMsg[0].name).toBe('my_trino_copy_2');
    });
  });

  describe('handleFileRequest', () => {
    it('sends file path back to webview on selection', async () => {
      mockConnectionMap = {my_trino: {is: 'trino'}};
      const panel = makePanel();
      await panel.editConnection('my_trino');

      mockShowOpenDialog.mockResolvedValueOnce([{fsPath: '/path/to/cert.pem'}]);

      await sendMessage(panel, {
        type: SingleConnectionMessageType.RequestFile,
        status: 'waiting',
        propName: 'privateKeyPath',
        filters: {PEM: ['pem', 'key']},
      });

      const messages = getMessages(panel);
      const fileMsg = messages.postMessage.mock.calls.find(
        (c: any[]) => c[0].type === SingleConnectionMessageType.RequestFile
      );
      expect(fileMsg).toBeDefined();
      expect(fileMsg[0].status).toBe(
        ConnectionServiceFileRequestStatus.Success
      );
      expect(fileMsg[0].fsPath).toBe('/path/to/cert.pem');
      expect(fileMsg[0].propName).toBe('privateKeyPath');
    });

    it('does not send message when dialog is cancelled', async () => {
      mockConnectionMap = {my_trino: {is: 'trino'}};
      const panel = makePanel();
      await panel.editConnection('my_trino');

      mockShowOpenDialog.mockResolvedValueOnce(undefined);

      await sendMessage(panel, {
        type: SingleConnectionMessageType.RequestFile,
        status: 'waiting',
        propName: 'privateKeyPath',
        filters: {},
      });

      const messages = getMessages(panel);
      const fileMsg = messages.postMessage.mock.calls.find(
        (c: any[]) => c[0].type === SingleConnectionMessageType.RequestFile
      );
      expect(fileMsg).toBeUndefined();
    });
  });
});

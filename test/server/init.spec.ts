/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Minimal mocks so initServer can be loaded and exercised without standing up
// a real LSP connection. Only the surfaces touched by the close handler need
// real behavior; everything else is a no-op stub.
// ---------------------------------------------------------------------------

let capturedOnDidClose: ((event: {document: any}) => void) | undefined;
const mockSendDiagnostics = jest.fn();

const makeDocsInstance = () => ({
  onDidChangeContent: jest.fn(),
  onDidClose: jest.fn((cb: any) => {
    capturedOnDidClose = cb;
  }),
  listen: jest.fn(),
  get: jest.fn(),
  all: jest.fn().mockReturnValue([]),
});

jest.mock(
  'vscode-languageserver',
  () => ({
    TextDocuments: jest.fn().mockImplementation(() => makeDocsInstance()),
    TextDocumentSyncKind: {Incremental: 2, Full: 1, None: 0},
  }),
  {virtual: true}
);

jest.mock(
  'vscode-languageserver-textdocument',
  () => ({TextDocument: class {}}),
  {virtual: true}
);

jest.mock('../../src/server/diagnostics', () => ({
  getMalloyDiagnostics: jest.fn().mockResolvedValue({}),
  aggregateNotebookDiagnostics: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../src/server/symbols', () => ({getMalloySymbols: jest.fn()}));
jest.mock('../../src/server/lenses', () => ({getMalloyLenses: jest.fn()}));
jest.mock('../../src/server/lenses/lenses', () => ({
  findMalloyLensesAt: jest.fn(),
}));
jest.mock('../../src/server/completions/completions', () => ({
  getCompletionItems: jest.fn(),
  resolveCompletionItem: jest.fn(),
}));
jest.mock('../../src/server/hover/hover', () => ({getHover: jest.fn()}));
jest.mock('../../src/server/definitions/definitions', () => ({
  getMalloyDefinitionReference: jest.fn(),
}));
jest.mock('../../src/server/code_actions/code_actions', () => ({
  getMalloyCodeAction: jest.fn(),
}));
jest.mock('../../src/common/log', () => ({
  prettyLogUri: (s: string) => s,
}));
jest.mock('../../src/server/translate_cache', () => ({
  TranslateCache: jest.fn().mockImplementation(() => ({
    dependentsOf: jest.fn().mockReturnValue([]),
    dependenciesFor: jest.fn().mockReturnValue([]),
    deleteModel: jest.fn(),
    deleteAllModels: jest.fn(),
  })),
}));

import {initServer} from '../../src/server/init';

function makeConnection(): any {
  return {
    console: {info: jest.fn(), error: jest.fn()},
    onInitialize: jest.fn(),
    onDocumentSymbol: jest.fn(),
    onCodeLens: jest.fn(),
    onCodeAction: jest.fn(),
    onRequest: jest.fn(),
    onDefinition: jest.fn(),
    onDidChangeConfiguration: jest.fn(),
    onCompletion: jest.fn(),
    onCompletionResolve: jest.fn(),
    onHover: jest.fn(),
    sendDiagnostics: mockSendDiagnostics,
    sendRequest: jest.fn(),
    listen: jest.fn(),
  };
}

function makeConnectionManager(): any {
  return {
    setSecretResolver: jest.fn(),
    setURLReader: jest.fn(),
    setWorkspaceRoots: jest.fn(),
    setConnectionsConfig: jest.fn(),
    setGlobalConfigDirectory: jest.fn(),
    notifyConfigFileChanged: jest.fn(),
    getEffectiveConfigSource: jest.fn(),
  };
}

describe('initServer — document close behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnDidClose = undefined;
  });

  it('clears diagnostics for a document when its editor is closed', () => {
    // Why: VS Code keeps published diagnostics in the Problems panel until
    // the server explicitly clears them. If the server doesn't send an empty
    // diagnostics array on close, errors from a closed editor linger forever.
    // The fix is one line in onDidClose: connection.sendDiagnostics({uri,
    // diagnostics: []}). This test pins that behavior so it doesn't regress.
    const connection = makeConnection();
    const manager = makeConnectionManager();

    initServer(connection, manager);

    expect(capturedOnDidClose).toBeDefined();
    capturedOnDidClose!({document: {uri: 'file:///workspace/foo.malloy'}});

    expect(mockSendDiagnostics).toHaveBeenCalledWith({
      uri: 'file:///workspace/foo.malloy',
      diagnostics: [],
    });
  });
});

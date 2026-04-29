const mockReadFile = jest.fn();
let mockTextDocuments: unknown[] = [];
let mockNotebookDocuments: unknown[] = [];

type MockUri = {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
  toString: () => string;
};

const mockUri = (uriString: string): MockUri => {
  const parsed = new URL(uriString);
  return {
    scheme: parsed.protocol.replace(/:$/, ''),
    authority: parsed.host,
    path: parsed.pathname,
    query: parsed.search.replace(/^\?/, ''),
    fragment: parsed.hash.replace(/^#/, ''),
    toString: () => uriString,
  };
};

jest.mock(
  'vscode',
  () => ({
    Uri: {
      parse: jest.fn((uriString: string) => mockUri(uriString)),
      from: jest.fn(
        ({
          scheme,
          authority = '',
          path,
          query = '',
        }: {
          scheme: string;
          authority?: string;
          path: string;
          query?: string;
        }) => {
          const queryString = query ? `?${query}` : '';
          return mockUri(`${scheme}://${authority}${path}${queryString}`);
        }
      ),
    },
    workspace: {
      get textDocuments() {
        return mockTextDocuments;
      },
      get notebookDocuments() {
        return mockNotebookDocuments;
      },
      fs: {
        readFile: mockReadFile,
      },
      workspaceFolders: [],
    },
  }),
  {virtual: true}
);

import {fetchFile} from '../../src/extension/utils/files';

describe('extension file utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTextDocuments = [];
    mockNotebookDocuments = [];
  });

  // Regression test for the loadModel/extendModel cross-cell bug: when the
  // Malloy compiler follows a cell URL, fetchFile MUST return the live cell
  // text, not fall through to workspace.fs.readFile (which reads the whole
  // notebook container). See src/extension/notebook/CONTEXT.md.
  it('reads notebook cell text from the open notebook document', async () => {
    const cellUri = 'vscode-notebook-cell:///workspace/imdb.malloynb#cell-1';
    const cellText = 'source: movies is duckdb.sql("""select 1 as id""")\n';
    const cellDocument = {
      uri: mockUri(cellUri),
      getText: jest.fn(() => cellText),
    };
    mockNotebookDocuments = [
      {
        uri: mockUri('file:///workspace/imdb.malloynb'),
        getCells: jest.fn(() => [{document: cellDocument}]),
      },
    ];

    await expect(fetchFile(cellUri)).resolves.toBe(cellText);
    expect(cellDocument.getText).toHaveBeenCalledTimes(1);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  // Guards the inverse: non-cell URIs must still reach the filesystem. If a
  // future change "simplifies" fetchFile by always running the cell lookup,
  // regular file reads would silently break.
  it('falls through to the filesystem for non-notebook-cell URIs', async () => {
    const fileUri = 'file:///workspace/regular.malloy';
    const fileText = 'source: orders is duckdb.sql("""select 1 as id""")\n';
    mockReadFile.mockResolvedValueOnce(new TextEncoder().encode(fileText));

    await expect(fetchFile(fileUri)).resolves.toBe(fileText);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });
});

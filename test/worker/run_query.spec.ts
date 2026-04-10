import {CancellationToken, Disposable} from 'vscode-jsonrpc';
import {runQuery} from '../../src/worker/run_query';
import {createRunnable} from '../../src/worker/create_runnable';
import {Runtime} from '@malloydata/malloy';
import {QueryRunStatus} from '../../src/common/types/message_types';
import {ConnectionManager} from '../../src/common/types/connection_manager_types';
import {FileHandler} from '../../src/common/types/file_handler';
import {
  MessageRun,
  WorkerMessageHandler,
} from '../../src/common/types/worker_message_types';

jest.mock('../../src/worker/create_runnable', () => ({
  createRunnable: jest.fn(),
  createModelMaterializer: jest.fn(),
}));

jest.mock('@malloydata/malloy', () => ({
  Runtime: jest.fn().mockImplementation(() => ({})),
  MalloyError: class MalloyError extends Error {
    problems: unknown[];
    constructor(message: string, problems: unknown[] = []) {
      super(message);
      this.problems = problems;
    }
  },
  isSourceDef: jest.fn().mockReturnValue(false),
  Result: class Result {},
}));

const mockedCreateRunnable = createRunnable as jest.MockedFunction<
  typeof createRunnable
>;
const mockedRuntime = Runtime as unknown as jest.Mock;

describe('runQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses getPreparedResult sql/schema path (regression for virtualMap fallback) and passes config into Runtime', async () => {
    const sentStatuses: QueryRunStatus[] = [];
    const sentMessages: unknown[] = [];

    const messageHandler: WorkerMessageHandler = {
      onRequest: jest.fn(() => ({dispose: () => undefined}) as Disposable),
      sendProgress: jest.fn(async (_type, _token, value) => {
        sentStatuses.push((value as {status: QueryRunStatus}).status);
        sentMessages.push(value);
      }),
      sendRequest: jest.fn(),
      log: jest.fn(),
    };

    const fileHandler: FileHandler = {
      readURL: jest.fn(async () => ''),
      fetchFile: jest.fn(async () => ''),
      fetchBinaryFile: jest.fn(async () => new Uint8Array()),
      fetchCellData: jest.fn(async () => ({baseUri: '', cells: []})),
      fetchWorkspaceFolders: jest.fn(async () => []),
    };

    const lookupConnection = jest.fn();
    const config = {
      connections: {lookupConnection},
      manifest: {buildManifest: {id: {tableName: 't'}}},
    };
    const connectionManager: ConnectionManager = {
      getConnectionLookup: jest.fn(async () => ({lookupConnection})),
      setConnectionsConfig: jest.fn(),
      getConfigForFile: jest.fn(async () => config as never),
    };

    const preparedResultSql = 'SELECT from_getPreparedResult';
    const getSQL = jest.fn(async () => 'SELECT from_getSQL');
    const getPreparedResult = jest.fn(async () => ({
      sql: preparedResultSql,
      resultExplore: {
        limit: 50,
        toJSON: () => ({name: 'result_explore'}),
      },
      sourceExplore: undefined,
    }));
    const getPreparedQuery = jest.fn(async () => ({
      dialect: 'duckdb',
      preparedResult: {sql: 'SELECT from_preparedQuery_preparedResult'},
    }));

    mockedCreateRunnable.mockResolvedValue({
      getPreparedQuery,
      getPreparedResult,
      getSQL,
      estimateQueryCost: jest.fn(async () => ({queryCostBytes: 123})),
      run: jest.fn(),
    } as never);

    const messageRun: MessageRun = {
      panelId: 'panel-1',
      name: 'query',
      showSQLOnly: true,
      showSchemaOnly: false,
      query: {
        type: 'file',
        documentMeta: {
          fileName: 'test.malloy',
          uri: 'file:///project/test.malloy',
          languageId: 'malloy',
          version: 1,
        },
      },
    };

    const cancellationToken: CancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: jest.fn(
        () => ({dispose: () => undefined}) as Disposable
      ),
    };

    await runQuery(
      messageHandler,
      fileHandler,
      connectionManager,
      false,
      messageRun,
      cancellationToken
    );

    expect(getPreparedQuery).toHaveBeenCalledTimes(1);
    expect(getPreparedResult).toHaveBeenCalledTimes(1);
    expect(getSQL).not.toHaveBeenCalled();
    expect(lookupConnection).not.toHaveBeenCalled();

    const compiledMessage = sentMessages.find(
      (message): message is {status: QueryRunStatus; sql: string} =>
        (message as {status?: QueryRunStatus}).status ===
        QueryRunStatus.Compiled
    );
    expect(compiledMessage?.sql).toBe(preparedResultSql);

    expect(sentStatuses).toContain(QueryRunStatus.Compiling);
    expect(sentStatuses).toContain(QueryRunStatus.Compiled);
    expect(sentStatuses).toContain(QueryRunStatus.EstimatedCost);

    expect(mockedRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        urlReader: fileHandler,
        config,
      })
    );
  });
});

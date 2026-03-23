import {CommonConnectionManager} from '../../src/common/connection_manager';
import {
  ConnectionFactory,
  MalloyConfigResult,
} from '../../src/common/connections/types';

function makeFactory(
  findMalloyConfigImpl: (
    fileURL: URL,
    workspaceRoots: string[],
    globalConfigDirectory?: string
  ) => MalloyConfigResult | undefined
): ConnectionFactory {
  return {
    reset: jest.fn(),
    getWorkingDirectory: jest.fn((url: URL) => {
      const path = url.pathname;
      const slash = path.lastIndexOf('/');
      return slash >= 0 ? path.substring(0, slash) : path;
    }),
    findMalloyConfig: findMalloyConfigImpl,
  };
}

describe('CommonConnectionManager integration (real MalloyConfig)', () => {
  it('parses virtualMap as Map and refreshes manifest on cached config', () => {
    let manifestText = JSON.stringify({id1: {tableName: 'cached_table_1'}});
    const configText = JSON.stringify({
      connections: {},
      virtualMap: {
        vduckdb: {
          flights: '/tmp/flights.parquet',
        },
      },
    });

    const factory = makeFactory(() => ({
      configText,
      configDir: '/project',
      manifestText,
    }));
    const manager = new CommonConnectionManager(factory);
    const fileURL = new URL('file:///project/models/query.malloy');

    const config1 = manager.getConfigForFile(fileURL);
    expect(config1).toBeDefined();
    expect(config1?.virtualMap).toBeInstanceOf(Map);
    const byConnection = config1?.virtualMap?.get('vduckdb');
    expect(byConnection).toBeInstanceOf(Map);
    expect(byConnection?.get('flights')).toBe('/tmp/flights.parquet');
    expect(config1?.manifest.buildManifest).toEqual(
      expect.objectContaining({
        entries: {
          id1: {tableName: 'cached_table_1'},
        },
      })
    );

    manifestText = JSON.stringify({id2: {tableName: 'cached_table_2'}});
    manager.getConnectionLookup(fileURL);
    const config2 = manager.getConfigForFile(fileURL);
    expect(config2).toBe(config1);
    expect(config2?.manifest.buildManifest).toEqual(
      expect.objectContaining({
        entries: {
          id2: {tableName: 'cached_table_2'},
        },
      })
    );
  });
});

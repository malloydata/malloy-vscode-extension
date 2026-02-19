/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

jest.mock('vscode', () => ({}), {virtual: true});
jest.mock('../../src/extension/logger', () => ({
  malloyLog: {appendLine: jest.fn()},
}));

import {convertLegacyConnections} from '../../src/extension/connection_migration';

describe('convertLegacyConnections', () => {
  it('converts a simple entry', () => {
    const legacy = [
      {
        name: 'mydb',
        id: 'abc-123',
        backend: 'duckdb',
        databasePath: ':memory:',
      },
    ];

    const {connections, logs, warnings} = convertLegacyConnections(legacy);

    expect(connections).toEqual({
      mydb: {is: 'duckdb', databasePath: ':memory:'},
    });
    expect(logs).toContain("Converted 'mydb' (duckdb)");
    expect(warnings).toHaveLength(0);
  });

  it('converts multiple entries', () => {
    const legacy = [
      {name: 'mydb', id: '1', backend: 'duckdb'},
      {name: 'wh', id: '2', backend: 'bigquery', projectId: 'my-proj'},
    ];

    const {connections} = convertLegacyConnections(legacy);

    expect(connections).toEqual({
      mydb: {is: 'duckdb'},
      wh: {is: 'bigquery', projectId: 'my-proj'},
    });
  });

  it('drops id and backend fields', () => {
    const legacy = [
      {name: 'mydb', id: 'abc-123', backend: 'duckdb', databasePath: '/tmp'},
    ];

    const {connections} = convertLegacyConnections(legacy);

    expect(connections['mydb']).not.toHaveProperty('id');
    expect(connections['mydb']).not.toHaveProperty('backend');
    expect(connections['mydb']).not.toHaveProperty('name');
  });

  it('drops GizmoSQL entries with warning', () => {
    const legacy = [
      {name: 'gizmo1', id: '1', backend: 'gizmosql'},
      {name: 'mydb', id: '2', backend: 'duckdb'},
    ];

    const {connections, warnings} = convertLegacyConnections(legacy);

    expect(connections).toEqual({mydb: {is: 'duckdb'}});
    expect(warnings).toContain("Dropped GizmoSQL entry 'gizmo1'");
  });

  it('handles duplicate names by keeping first', () => {
    const legacy = [
      {name: 'mydb', id: '1', backend: 'duckdb'},
      {name: 'mydb', id: '2', backend: 'bigquery'},
    ];

    const {connections, warnings} = convertLegacyConnections(legacy);

    expect(connections).toEqual({mydb: {is: 'duckdb'}});
    expect(warnings[0]).toMatch(/duplicate.*mydb/i);
  });

  it('generates name for entries without one', () => {
    const legacy = [{id: '1', backend: 'duckdb'}];

    const {connections, logs} = convertLegacyConnections(legacy);

    expect(connections).toHaveProperty('duckdb-0');
    expect(connections['duckdb-0']).toEqual({is: 'duckdb'});
    expect(logs[0]).toMatch(/Generated name/);
  });

  it('converts additionalExtensions from array to comma-separated string', () => {
    const legacy = [
      {
        name: 'mydb',
        id: '1',
        backend: 'duckdb',
        additionalExtensions: ['spatial', 'httpfs'],
      },
    ];

    const {connections} = convertLegacyConnections(legacy);

    expect(connections['mydb']['additionalExtensions']).toBe('spatial,httpfs');
  });

  it('preserves unknown backends', () => {
    const legacy = [
      {name: 'mydb', id: '1', backend: 'futurodb', customProp: 'value'},
    ];

    const {connections, logs} = convertLegacyConnections(legacy);

    expect(connections).toEqual({
      mydb: {is: 'futurodb', customProp: 'value'},
    });
    expect(logs).toContain("Converted 'mydb' (futurodb)");
  });

  it('handles empty array', () => {
    const {connections, logs, warnings} = convertLegacyConnections([]);

    expect(connections).toEqual({});
    expect(logs).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('preserves number and boolean properties', () => {
    const legacy = [
      {name: 'pg', id: '1', backend: 'postgres', port: 5432},
      {name: 'pub', id: '2', backend: 'publisher', readOnly: true},
    ];

    const {connections} = convertLegacyConnections(legacy);

    expect(connections['pg']['port']).toBe(5432);
    expect(connections['pub']['readOnly']).toBe(true);
  });

  it('converts $secret-*$ placeholders to {secretKey} references using UUID', () => {
    const legacy = [
      {
        name: 'mydb',
        id: 'abc-123',
        backend: 'postgres',
        host: 'localhost',
        password: '$secret-1708099200000$',
      },
    ];

    const {connections} = convertLegacyConnections(legacy);

    expect(connections['mydb']).toEqual({
      is: 'postgres',
      host: 'localhost',
      password: {secretKey: 'connections.abc-123.password'},
    });
  });

  it('converts multiple secret fields using UUID-based keys', () => {
    const legacy = [
      {
        name: 'sf',
        id: 'uuid-sf-1',
        backend: 'snowflake',
        account: 'myaccount',
        password: '$secret-1234$',
        privateKeyPass: '$secret-5678$',
      },
    ];

    const {connections} = convertLegacyConnections(legacy);

    expect(connections['sf']).toEqual({
      is: 'snowflake',
      account: 'myaccount',
      password: {secretKey: 'connections.uuid-sf-1.password'},
      privateKeyPass: {secretKey: 'connections.uuid-sf-1.privateKeyPass'},
    });
  });

  it('falls back to name for secretKey when entry has no id', () => {
    const legacy = [
      {
        name: 'mydb',
        backend: 'postgres',
        host: 'db.example.com',
        password: '$secret-999$',
      },
    ];

    const {connections} = convertLegacyConnections(legacy);

    expect(connections['mydb']['host']).toBe('db.example.com');
    expect(connections['mydb']['password']).toEqual({
      secretKey: 'connections.mydb.password',
    });
  });

  it('skips non-primitive properties', () => {
    const legacy = [
      {
        name: 'mydb',
        id: '1',
        backend: 'duckdb',
        complexProp: {nested: true},
      },
    ];

    const {connections} = convertLegacyConnections(
      legacy as {
        name: string;
        id: string;
        backend: string;
        [key: string]: unknown;
      }[]
    );

    expect(connections['mydb']).not.toHaveProperty('complexProp');
  });
});

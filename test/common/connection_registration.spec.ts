/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

let mockRegisteredTypes: string[] = [];

jest.mock('@malloydata/malloy', () => {
  const actual = jest.requireActual('@malloydata/malloy');
  return {
    ...actual,
    getRegisteredConnectionTypes: () => mockRegisteredTypes,
  };
});

import {getDefaultConnections} from '../../src/common/connection_manager';

describe('getDefaultConnections', () => {
  afterEach(() => {
    mockRegisteredTypes = [];
  });

  it('browser: aliases duckdb to duckdb_wasm when only wasm is registered', () => {
    mockRegisteredTypes = ['duckdb_wasm'];

    const defaults = getDefaultConnections();

    expect(defaults).toEqual({
      duckdb: {is: 'duckdb_wasm'},
    });
    // No md alias in browser
    expect(defaults['md']).toBeUndefined();
  });

  it('node: creates one entry per type plus md alias', () => {
    mockRegisteredTypes = ['duckdb', 'postgres', 'bigquery'];

    const defaults = getDefaultConnections();

    expect(defaults['duckdb']).toEqual({is: 'duckdb'});
    expect(defaults['postgres']).toEqual({is: 'postgres'});
    expect(defaults['bigquery']).toEqual({is: 'bigquery'});
    expect(defaults['md']).toEqual({is: 'duckdb', databasePath: 'md:'});
  });

  it('node: includes md alias even with only duckdb registered', () => {
    mockRegisteredTypes = ['duckdb'];

    const defaults = getDefaultConnections();

    expect(defaults['duckdb']).toEqual({is: 'duckdb'});
    expect(defaults['md']).toEqual({is: 'duckdb', databasePath: 'md:'});
  });

  it('returns empty when nothing is registered', () => {
    mockRegisteredTypes = [];

    const defaults = getDefaultConnections();

    // No wasm, no duckdb — falls through to node path with empty loop
    expect(defaults).toEqual({md: {is: 'duckdb', databasePath: 'md:'}});
  });
});

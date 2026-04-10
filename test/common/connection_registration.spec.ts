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

import {CommonConnectionManager} from '../../src/common/connection_manager';

describe('getDefaultConnectionTypes', () => {
  afterEach(() => {
    mockRegisteredTypes = [];
  });

  it('browser: aliases duckdb to duckdb_wasm when only wasm is registered', () => {
    mockRegisteredTypes = ['duckdb_wasm'];

    const defaults = CommonConnectionManager.getDefaultConnectionTypes();

    expect(defaults).toEqual({
      duckdb: 'duckdb_wasm',
    });
    // No md alias in browser
    expect(defaults['md']).toBeUndefined();
  });

  it('node: creates one entry per type plus md alias', () => {
    mockRegisteredTypes = ['duckdb', 'postgres', 'bigquery'];

    const defaults = CommonConnectionManager.getDefaultConnectionTypes();

    expect(defaults['duckdb']).toEqual('duckdb');
    expect(defaults['postgres']).toEqual('postgres');
    expect(defaults['bigquery']).toEqual('bigquery');
    expect(defaults['md']).toEqual('duckdb');
  });

  it('node: includes md alias even with only duckdb registered', () => {
    mockRegisteredTypes = ['duckdb'];

    const defaults = CommonConnectionManager.getDefaultConnectionTypes();

    expect(defaults['duckdb']).toEqual('duckdb');
    expect(defaults['md']).toEqual('duckdb');
  });

  it('returns empty when nothing is registered', () => {
    mockRegisteredTypes = [];

    const defaults = CommonConnectionManager.getDefaultConnectionTypes();

    // No wasm, no duckdb — falls through to node path with empty loop
    expect(defaults).toEqual({md: 'duckdb'});
  });
});

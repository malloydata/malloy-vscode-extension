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
import {ConnectionFactory} from '../../src/common/connections/types';

const nodeFactory: ConnectionFactory = {};
const browserFactory: ConnectionFactory = {
  getDefaultConnections: () => ({duckdb: 'duckdb_wasm'}),
};

describe('getDefaultConnectionTypes', () => {
  afterEach(() => {
    mockRegisteredTypes = [];
  });

  it('browser: factory list is authoritative — only `duckdb` shown, no md', () => {
    mockRegisteredTypes = ['duckdb_wasm'];

    const defaults = new CommonConnectionManager(
      browserFactory
    ).getDefaultConnectionTypes();

    expect(defaults).toEqual({duckdb: 'duckdb_wasm'});
    // The bare `duckdb_wasm` type isn't surfaced — the factory speaks for it.
    expect(defaults['duckdb_wasm']).toBeUndefined();
    // MotherDuck isn't supported on WASM, so no md alias.
    expect(defaults['md']).toBeUndefined();
  });

  it('node: one entry per registered type plus md alias', () => {
    mockRegisteredTypes = ['duckdb', 'postgres', 'bigquery'];

    const defaults = new CommonConnectionManager(
      nodeFactory
    ).getDefaultConnectionTypes();

    expect(defaults['duckdb']).toBe('duckdb');
    expect(defaults['postgres']).toBe('postgres');
    expect(defaults['bigquery']).toBe('bigquery');
    expect(defaults['md']).toBe('duckdb');
  });

  it('node: includes md alias when only duckdb is registered', () => {
    mockRegisteredTypes = ['duckdb'];

    const defaults = new CommonConnectionManager(
      nodeFactory
    ).getDefaultConnectionTypes();

    expect(defaults['duckdb']).toBe('duckdb');
    expect(defaults['md']).toBe('duckdb');
  });

  it('node: no md alias when duckdb is not registered', () => {
    mockRegisteredTypes = ['postgres'];

    const defaults = new CommonConnectionManager(
      nodeFactory
    ).getDefaultConnectionTypes();

    expect(defaults).toEqual({postgres: 'postgres'});
    expect(defaults['md']).toBeUndefined();
  });

  it('returns empty when nothing is registered and factory is silent', () => {
    mockRegisteredTypes = [];

    const defaults = new CommonConnectionManager(
      nodeFactory
    ).getDefaultConnectionTypes();

    expect(defaults).toEqual({});
  });
});

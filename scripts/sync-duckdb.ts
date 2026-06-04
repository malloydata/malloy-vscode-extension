#!/usr/bin/env ts-node
/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * sync-duckdb — keep the extension's pinned DuckDB version in lockstep with
 * @malloydata/db-duckdb.
 *
 * WHY THIS EXISTS
 * ---------------
 * The extension does not import @duckdb/node-api from any source file. The
 * direct pin exists purely to drive packaging of DuckDB's native binary:
 *   - scripts/utils/fetch_duckdb.ts reads the installed @duckdb/node-api to
 *     learn which @duckdb/node-bindings-<os>-<cpu> binary to fetch, and
 *   - .vscodeignore ships the top-level node_modules/@duckdb/node-bindings*
 *     into the .vsix.
 * Both resolve the *top-level* copy, i.e. this pin.
 *
 * Meanwhile esbuild bundles @malloydata/db-duckdb, whose `require("@duckdb/
 * node-api")` resolves to *its* copy. If the pin drifts from db-duckdb's
 * version, two copies get installed (this stale pin on top, db-duckdb's newer
 * one nested) and the .vsix ships a native binary whose ABI does not match the
 * node-api JS that actually runs — a latent runtime break.
 *
 * The drift is silent because `npm run malloy-update` only bumps @malloydata/*,
 * and a DuckDB prerelease like 1.5.3-r.2 does not satisfy a caret range like
 * ^1.5.0-r.1 under semver, so npm keeps the two copies instead of erroring.
 *
 * HOW IT STAYS CORRECT
 * --------------------
 * The source of truth is @duckdb/node-api *as db-duckdb resolves it*, not the
 * extension's own node_modules. We resolve starting from db-duckdb's directory
 * so we read the version db-duckdb actually depends on, whether that copy is
 * hoisted to the top level or nested under db-duckdb.
 *
 * BEHAVIOR
 * --------
 * Resolution and validation happen before any write, so a failure leaves
 * package.json untouched. Exits 0 without writing when already in sync. On any
 * problem it prints a single actionable line and exits non-zero.
 *
 * Run after updating malloy packages — `npm run malloy-update` does this.
 */
import fs from 'fs';
import path from 'path';

const PKG_PATH = path.resolve(__dirname, '..', 'package.json');

/** The package.json fields this script reads. */
interface PackageJson {
  version?: string;
  dependencies?: Record<string, string>;
}

/** Print one actionable line and abort without touching package.json. */
function fail(message: string): never {
  console.error(`sync-duckdb: ${message}`);
  process.exit(1);
}

function main(): void {
  // Anchor the @duckdb/node-api lookup at db-duckdb's directory (see header).
  let dbDuckDBDir: string;
  try {
    dbDuckDBDir = path.dirname(
      require.resolve('@malloydata/db-duckdb/package.json')
    );
  } catch {
    fail('@malloydata/db-duckdb is not installed — run `npm install` first');
  }

  let resolved: string;
  try {
    resolved = require.resolve('@duckdb/node-api/package.json', {
      paths: [dbDuckDBDir],
    });
  } catch {
    fail(
      'cannot resolve @duckdb/node-api from @malloydata/db-duckdb — run `npm install` first'
    );
  }

  let nodeApi: PackageJson;
  try {
    nodeApi = JSON.parse(fs.readFileSync(resolved, 'utf-8')) as PackageJson;
  } catch (e) {
    fail(`cannot read ${resolved}: ${(e as Error).message}`);
  }

  const wantedApiVersion = nodeApi.version;
  if (!wantedApiVersion) {
    fail('@duckdb/node-api package.json has no version field');
  }

  // Load the extension's package.json.
  let pkg: PackageJson;
  try {
    pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8')) as PackageJson;
  } catch (e) {
    fail(`cannot read ${PKG_PATH}: ${(e as Error).message}`);
  }
  const deps = pkg.dependencies ?? {};
  const current = deps['@duckdb/node-api'];

  if (current === wantedApiVersion) {
    console.log('@duckdb/node-api already in sync, no update needed');
    return;
  }

  console.log(
    `@duckdb/node-api: ${current ?? '(absent)'} -> ${wantedApiVersion}`
  );
  deps['@duckdb/node-api'] = wantedApiVersion;
  pkg.dependencies = deps;

  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
  console.log('Updated package.json');
}

main();

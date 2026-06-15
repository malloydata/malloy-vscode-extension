#!/usr/bin/env ts-node
/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/*
 * Shared helpers for the native-dependency guard.
 *
 * A "native" package is one that ships or builds a platform-specific binary:
 * in package-lock.json those entries carry an `os`/`cpu` constraint (the
 * modern prebuilt-binary pattern, e.g. @duckdb/node-bindings-darwin-arm64) or
 * `hasInstallScript: true` (node-gyp build-from-source). esbuild cannot bundle
 * the `.node` files such packages contain, so a new one appearing silently in
 * the dependency tree breaks the extension build. We track the approved set in
 * approved-native-deps.json and fail `malloy-update` when an unapproved native
 * package shows up.
 */

import * as fs from 'fs';
import * as path from 'path';

export const APPROVED_FILE = path.join(__dirname, 'approved-native-deps.json');
const LOCK_FILE = path.join(__dirname, '..', 'package-lock.json');

export interface ApprovedEntry {
  version: string;
  note: string;
}

export type ApprovedList = Record<string, ApprovedEntry>;

export interface NativePackage {
  name: string;
  version: string;
  os?: string[];
  cpu?: string[];
  hasInstallScript?: boolean;
}

interface LockPackage {
  version?: string;
  os?: string[];
  cpu?: string[];
  hasInstallScript?: boolean;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

// The bare package name is whatever follows the last "node_modules/" segment,
// so "node_modules/@scope/name/node_modules/@s/n" -> "@s/n".
function bareName(lockPath: string): string {
  const idx = lockPath.lastIndexOf('node_modules/');
  return idx === -1 ? lockPath : lockPath.slice(idx + 'node_modules/'.length);
}

export function readLock(): Record<string, LockPackage> {
  const lock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
  return lock.packages ?? {};
}

// Every native package in the current lockfile, keyed by bare name. When the
// same name appears at multiple paths (it shouldn't differ), the last wins —
// versions of a given native package are consistent across the tree in practice.
export function collectNativePackages(): Map<string, NativePackage> {
  const packages = readLock();
  const found = new Map<string, NativePackage>();
  for (const [lockPath, meta] of Object.entries(packages)) {
    if (lockPath === '') continue; // the root project
    const isNative =
      (Array.isArray(meta.os) && meta.os.length > 0) ||
      (Array.isArray(meta.cpu) && meta.cpu.length > 0) ||
      meta.hasInstallScript === true;
    if (!isNative) continue;
    const name = bareName(lockPath);
    found.set(name, {
      name,
      version: meta.version ?? '',
      os: meta.os,
      cpu: meta.cpu,
      hasInstallScript: meta.hasInstallScript,
    });
  }
  return found;
}

// Best-effort: which installed package lists `name` among its (optional)
// dependencies. Used only to make the failure message more actionable.
export function findParents(name: string): string[] {
  const packages = readLock();
  const parents = new Set<string>();
  for (const [lockPath, meta] of Object.entries(packages)) {
    const deps = {...meta.dependencies, ...meta.optionalDependencies};
    if (name in deps) {
      const parent = lockPath === '' ? '(root project)' : bareName(lockPath);
      parents.add(`${parent}@${meta.version ?? '?'}`);
    }
  }
  return Array.from(parents);
}

export function readApproved(): ApprovedList {
  if (!fs.existsSync(APPROVED_FILE)) return {};
  return JSON.parse(fs.readFileSync(APPROVED_FILE, 'utf8'));
}

export function writeApproved(list: ApprovedList): void {
  const sorted: ApprovedList = {};
  for (const name of Object.keys(list).sort()) {
    sorted[name] = list[name];
  }
  fs.writeFileSync(APPROVED_FILE, JSON.stringify(sorted, null, 2) + '\n');
}

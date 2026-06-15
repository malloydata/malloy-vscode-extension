#!/usr/bin/env ts-node
/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/*
 * Fails if package-lock.json contains a native package (one that ships or
 * builds a platform-specific binary) that is not listed in
 * approved-native-deps.json. Wired into `npm run malloy-update` so a routine
 * dependency bump that floats in a new native package is caught locally,
 * before it reaches CI as an unbundleable ".node" esbuild error.
 *
 * When this fails you have two choices:
 *   - pin the offending dependency (locally, or upstream in malloy), then
 *     re-run; or
 *   - accept it: handle its `.node` binary in the build/packaging, then run
 *     `npm run approve-native` to record it.
 */

import {collectNativePackages, findParents, readApproved} from './native-deps';

const native = collectNativePackages();
const approved = readApproved();

const unapproved = Array.from(native.values()).filter(
  p => !(p.name in approved)
);

if (unapproved.length === 0) {
  console.log(`check-native: ${native.size} native package(s), all approved.`);
  process.exit(0);
}

console.error(
  '\n✗ check-native: native package(s) not in scripts/approved-native-deps.json:\n'
);
for (const p of unapproved.sort((a, b) => a.name.localeCompare(b.name))) {
  const constraint = [
    p.os ? `os=${p.os.join(',')}` : '',
    p.cpu ? `cpu=${p.cpu.join(',')}` : '',
    p.hasInstallScript ? 'install-script' : '',
  ]
    .filter(Boolean)
    .join(' ');
  console.error(`    ${p.name}@${p.version}  ${constraint}`);
  const parents = findParents(p.name).filter(
    parent => !parent.startsWith(p.name + '@')
  );
  if (parents.length > 0) {
    console.error(`      via: ${parents.join(', ')}`);
  }
}

console.error(
  '\nNative packages ship .node binaries esbuild cannot bundle. Either pin the\n' +
    'dependency (locally or upstream in malloy) and re-run, or handle its binary\n' +
    'in packaging and run `npm run approve-native` to record it.\n'
);
process.exit(1);

#!/usr/bin/env ts-node
/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/*
 * Regenerates scripts/approved-native-deps.json from the current
 * package-lock.json: every native package becomes an approved entry. Existing
 * `note` text is preserved so the human-written rationale for each approval
 * ("why is this binary ok") survives regeneration. Run this after you have
 * deliberately accepted a new native dependency (and handled its `.node`
 * binary in packaging). Review the resulting diff before committing.
 */

import {
  ApprovedList,
  collectNativePackages,
  readApproved,
  writeApproved,
} from './native-deps';

const native = collectNativePackages();
const existing = readApproved();

const next: ApprovedList = {};
Array.from(native.values()).forEach(p => {
  next[p.name] = {
    version: p.version,
    note: existing[p.name]?.note ?? '',
  };
});

const added = Array.from(native.keys()).filter(name => !(name in existing));
const removed = Object.keys(existing).filter(name => !native.has(name));

writeApproved(next);

console.log(
  `approve-native: wrote ${Object.keys(next).length} approved native package(s).`
);
if (added.length > 0) {
  console.log(`  added:   ${added.sort().join(', ')}`);
}
if (removed.length > 0) {
  console.log(`  removed: ${removed.sort().join(', ')}`);
}
console.log(
  'Review the diff in scripts/approved-native-deps.json before committing.'
);

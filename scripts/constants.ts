/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export const Targets = [
  'linux-x64',
  'linux-arm64',
  'linux-armhf',
  'alpine-x64',
  'alpine-arm64',
  'darwin-x64',
  'darwin-arm64',
  'win32-x64',
  'web',
] as const;

export type Target = (typeof Targets)[number];

function isTarget(value: string): value is Target {
  return Targets.some(t => t === value);
}

/**
 * The packaging Target for the machine this is running on.
 *
 * Native binaries (notably DuckDB) are fetched per-target, so packaging must
 * always commit to a concrete platform. When a target isn't given explicitly
 * we resolve it to the host rather than emit an untargeted .vsix — an
 * untargeted package ships only whatever binary happened to be in node_modules
 * and silently breaks on every other platform. Throws if the host isn't a
 * packageable target, so we never produce a mislabeled artifact.
 */
export function hostTarget(): Target {
  const triple = `${process.platform}-${process.arch}`;
  if (isTarget(triple)) {
    return triple;
  }
  throw new Error(
    `Cannot infer a packaging target for this machine (${triple}). ` +
      'Pass one explicitly, e.g. `npm run package-extension package darwin-arm64`. ' +
      `Valid native targets: ${Targets.filter(t => t !== 'web').join(', ')}.`
  );
}

export const outDir = 'dist/';

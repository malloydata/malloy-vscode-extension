/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {doBuild} from './build_common';
import {hostTarget, outDir, Target} from './constants';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import {createVSIX} from '@vscode/vsce';

export async function doPackage(
  target?: Target,
  version?: string,
  preRelease = false
): Promise<string> {
  // Native binaries are fetched per-target (see fetchDuckDB), so a package must
  // commit to a concrete platform. Default to this machine's target rather than
  // emit an untargeted .vsix that ships only the host binary and breaks on
  // every other platform.
  const packageTarget = target ?? hostTarget();
  await doBuild(false, packageTarget);

  // vsce uses package.json as a manifest, and has no way to pass in a version - it only reads
  // version info from package.json. This is annoying for many reasons, but particularly for
  // CI & for managing production vs pre-release versions programmatically.
  //
  // the hack here is to load package.json, change the version, write it out, package the VSIX,
  // then replace package.json with the original version. :(
  const packageJSON = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  if (!version) version = packageJSON.version; // get version info from package.json if it isn't passed in
  if (!semver.valid(version)) throw new Error(`Invalid semver: ${version}`);

  const packagePath = path.join(
    outDir,
    `malloy-vscode-${packageTarget}-${version}.vsix`
  );

  try {
    fs.copyFileSync('package.json', 'package.json.original');

    packageJSON.version = version;
    fs.writeFileSync('package.json', JSON.stringify(packageJSON, null, 2));

    await createVSIX({
      githubBranch: 'main',
      preRelease,
      useYarn: false,
      target: packageTarget,
      packagePath,
    });
  } finally {
    fs.copyFileSync('package.json.original', 'package.json');
    fs.rmSync('package.json.original');
  }

  return packagePath;
}

const args = process.argv.slice(2);
if (args[0] === 'package') {
  const target = args[1] ? (args[1] as Target) : undefined;
  const version = args[2];
  console.log(
    target
      ? `Packaging extension for ${target}`
      : 'Packaging extension with no target specified, using current machine as target'
  );

  doPackage(target, version)
    .then(() => {
      console.log('Extension packaged successfully');
    })
    .catch(error => {
      console.error('Extension packaged with errors');
      console.log(error);
      process.exit(1);
    });
}

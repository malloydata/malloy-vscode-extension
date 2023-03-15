/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
/* eslint-disable no-console */
/* eslint-disable no-process-exit */
/* eslint-disable node/no-unpublished-import */

import {doBuild, outDir, Target} from './build_common';
import * as path from 'path';
import * as semver from 'semver';
import {createVSIX} from 'vsce';

// importing this in normal fashion seems to import an older API?!
// for ex, when imported, "Property 'rmSync' does not exist on type 'typeof import("fs")'"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');

export async function doPackage(
  target?: Target,
  version?: string,
  preRelease = false
): Promise<string> {
  await doBuild(false, target);

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
    target
      ? `malloy-vscode-${target}-${version}.vsix`
      : `malloy-vscode-${version}.vsix`
  );

  try {
    fs.copyFileSync('package.json', 'package.json.original');

    packageJSON.version = version;
    if (target === 'web') {
      delete packageJSON['main'];
    } else {
      delete packageJSON['browser'];
    }
    fs.writeFileSync('package.json', JSON.stringify(packageJSON, null, 2));

    await createVSIX({
      githubBranch: 'main',
      preRelease,
      useYarn: false,
      target,
      packagePath,
      dependencies: false,
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

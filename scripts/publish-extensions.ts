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

import * as semver from "semver";
import { readFileSync } from "fs";
import { publishVSIX } from "vsce";
import { Target } from "./build_common";
import { targetKeytarMap } from "./utils/fetch_keytar";
import { doPackage } from "./package-extension";
import { publishCloudExtension } from "./publish-cloud-extension";

/**
 * @returns Array of version bits. [major, minor, patch]
 */
function getVersionBits(): Array<number> {
  return JSON.parse(readFileSync("package.json", "utf-8"))
    .version.split(".")
    .map(Number);
}

async function doPublish(version: string) {
  let preRelease = false;
  const versionBits = getVersionBits();

  // Enforcing recommendation that Releases use even numbered minor versions and pre-release uses odd minor versions.
  // See: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
  // Only release versions incrementing major or minor should be committed. (until incrementing is automated)
  // The final version bit (patch) will be auto-generated.
  if (versionBits[1] % 2 != 0) {
    throw new Error(
      "Invalid release version found in package.json. Release minor version should be even."
    );
  }
  switch (version) {
    case "pre-release":
      versionBits[1] += 1;
      versionBits[2] = Math.floor(Date.now() / 1000);
      preRelease = true;
      break;
    case "patch":
    case "minor":
    case "major":
      versionBits[2] = Math.floor(Date.now() / 1000);
      break;
    default:
      throw new Error(`Unknown version tag: ${version}.`);
  }

  const versionCode = versionBits.join(".");
  if (!semver.valid(versionCode))
    throw new Error(`Invalid semver: ${versionCode}`);

  console.log(
    `Publishing ${version} extensions with version code: ${versionCode}`
  );
  console.log(`Pre-release: ${preRelease}`);

  for (const target in targetKeytarMap) {
    const packagePath = await doPackage(
      target as Target,
      versionCode,
      preRelease
    );

    await publishVSIX(packagePath, {
      githubBranch: "main",
      preRelease: preRelease,
      useYarn: false,
      pat: process.env.VSCE_PAT,
    });
  }

  const packagePath = await doPackage("web", versionCode, preRelease);

  await publishVSIX(packagePath, {
    githubBranch: "main",
    preRelease: preRelease,
    useYarn: false,
    pat: process.env.VSCE_PAT,
  });

  if (!preRelease) {
    const cloudPackagePath = await doPackage(
      "linux-x64" as Target,
      versionCode,
      preRelease
    );
    await publishCloudExtension(cloudPackagePath, versionCode, preRelease);
  }
}

const args = process.argv.slice(2);
const version = args[0];
if (!version)
  throw new Error(
    "No version passed to publish script. Call it with 'patch' or 'pre-release'."
  );

console.log(`Starting ${version} publish for extensions`);

doPublish(version)
  .then(() => {
    console.log("Extensions published successfully");
  })
  .catch((error) => {
    console.error("Extension publishing errors:");
    console.log(error);
    process.exit(1);
  });

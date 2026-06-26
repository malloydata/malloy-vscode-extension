/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as semver from 'semver';
import {appendFileSync, readFileSync} from 'fs';
import {publishVSIX} from '@vscode/vsce';
import {doPackage} from './package-extension';
import {publishOvsx} from './publish-ovsx';
import {Target, Targets} from './constants';

const MARKETPLACE_URL =
  'https://marketplace.visualstudio.com/items?itemName=malloydata.malloy-vscode';

interface MarketplaceResult {
  target: Target;
  status: 'published' | 'failed';
}

/**
 * Append a VS Code Marketplace (Microsoft store) publish summary to the GitHub
 * Actions run page. No-op when not running in Actions (GITHUB_STEP_SUMMARY
 * unset), so local publishes are unaffected.
 */
function writeMarketplaceSummary(
  versionCode: string,
  preRelease: boolean,
  results: Array<MarketplaceResult>
): void {
  const summaryFile = process.env['GITHUB_STEP_SUMMARY'];
  if (!summaryFile || results.length === 0) return;

  const lines = [
    '## 🛍️ VS Code Marketplace Publish',
    '',
    `- **Version**: \`${versionCode}\``,
    `- **Channel**: ${preRelease ? 'pre-release' : 'release'}`,
    `- **Extension**: [malloydata.malloy-vscode](${MARKETPLACE_URL})`,
    '',
    '| Target | Result |',
    '| --- | --- |',
    ...results.map(
      r =>
        `| \`${r.target}\` | ${
          r.status === 'published' ? '✅ published' : '❌ failed'
        } |`
    ),
    '',
  ];
  appendFileSync(summaryFile, lines.join('\n') + '\n');
}

/**
 * @returns Array of version bits. [major, minor, patch]
 */
function getVersionBits(): Array<number> {
  return JSON.parse(readFileSync('package.json', 'utf-8'))
    .version.split('.')
    .map(Number);
}

async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 10000
): Promise<T> {
  for (let attempt = 1; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.log(
        `Attempt ${attempt}/${maxAttempts} failed, retrying in ${
          delayMs / 1000
        }s...`,
        error
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return await fn();
}

async function doPublish(version: string) {
  let preRelease = false;
  const versionBits = getVersionBits();

  // Enforcing recommendation that Releases use even numbered minor versions and pre-release uses odd minor versions.
  // See: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
  // Only release versions incrementing major or minor should be committed. (until incrementing is automated)
  // The final version bit (patch) will be auto-generated.
  if (versionBits[1] % 2 !== 0) {
    throw new Error(
      'Invalid release version found in package.json. Release minor version should be even.'
    );
  }
  switch (version) {
    case 'pre-release':
      versionBits[1] += 1;
      versionBits[2] = Math.floor(Date.now() / 1000);
      preRelease = true;
      break;
    case 'patch':
    case 'minor':
    case 'major':
      versionBits[2] = Math.floor(Date.now() / 1000);
      break;
    default:
      throw new Error(`Unknown version tag: ${version}.`);
  }

  const versionCode = versionBits.join('.');
  if (!semver.valid(versionCode))
    throw new Error(`Invalid semver: ${versionCode}`);

  console.log(
    `Publishing ${version} extensions with version code: ${versionCode}`
  );
  console.log(`Pre-release: ${preRelease}`);

  const marketplaceResults: Array<MarketplaceResult> = [];
  try {
    for (const target of Targets) {
      const packagePath = await doPackage(target, versionCode, preRelease);

      try {
        await retry(() =>
          publishVSIX(packagePath, {
            githubBranch: 'main',
            preRelease: preRelease,
            useYarn: false,
            pat: process.env['VSCE_PAT'],
          })
        );
        marketplaceResults.push({target, status: 'published'});
      } catch (error) {
        marketplaceResults.push({target, status: 'failed'});
        throw error;
      }

      await retry(() => publishOvsx(packagePath, target, preRelease));
    }
  } finally {
    // Record the Microsoft store results even on a mid-loop failure, so the
    // run page shows exactly which targets made it out before things broke.
    writeMarketplaceSummary(versionCode, preRelease, marketplaceResults);
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
    console.log('Extensions published successfully');
  })
  .catch(error => {
    console.error('Extension publishing errors:');
    console.log(error);
    process.exit(1);
  });

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

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const GITHUB_API_URL = 'https://api.github.com/repos';
const GITHUB_API_MIME_TYPE = 'application/vnd.github+json';

const GITHUB_UPLOAD_URL = 'https://uploads.github.com/repos';

const REPO = 'malloy-vscode-extension';
const REPO_OWNER = 'malloydata';

/**
 * Publishes the cloud extension as a github release.
 *
 * @param path Path to extension vsix
 * @param versionCode Version Tag to use for release
 * @param preRelease Indicates if this release is pre-release
 */
export async function publishCloudExtension(
  path: string,
  versionCode: string,
  preRelease: boolean
): Promise<void> {
  const release = await createRelease(versionCode, preRelease);
  const asset = await uploadAsset(release, path, 'malloy-cloud-extension.vsix');

  console.log(`  Asset Download URL: ${asset.browser_download_url}`);
  console.log('  Extension successfully published to GitHub');
}

/**
 * Creates a new release in github.
 *
 * @param versionCode Version Tag to use for github release
 * @param preRelease Indicates if this release should be marked pre-release
 */
async function createRelease(
  versionCode: string,
  preRelease: boolean
): Promise<GithubRelease> {
  console.log('Creating Github Release for cloud extension:');
  console.log(`  Version: ${versionCode}`);
  console.log(`  Pre-Release: ${preRelease}`);

  const response = await fetch(
    `${GITHUB_API_URL}/${REPO_OWNER}/${REPO}/releases`,
    {
      method: 'POST',
      headers: {
        Accept: GITHUB_API_MIME_TYPE,
        Authorization: `Bearer ${process.env['GHAPI_PAT']}`,
      },
      body: JSON.stringify({
        repo: REPO,
        owner: REPO_OWNER,
        tag_name: versionCode,
        target_commitish: 'main',
        name: versionCode,
        draft: false,
        prerelease: preRelease,
        generate_release_notes: true,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Error Creating Release:\n${JSON.stringify(response, null, 2)}`
    );
  }

  return (await response.json()) as GithubRelease;
}

/**
 * Creates a new release in github.
 *
 * @param release Github release
 * @param preRelease Indicates if this release should be marked pre-release
 */
async function uploadAsset(
  release: GithubRelease,
  assetPath: string,
  assetName: string
): Promise<GithubAsset> {
  console.log(`  Uploading release asset: ${assetPath}`);

  const fullAssetPath = path.resolve(__dirname, '..', assetPath);
  const uploadAssetUrl = `${GITHUB_UPLOAD_URL}/${REPO_OWNER}/${REPO}/releases/${release.id}/assets?name=${assetName}`;

  const response = await fetch(uploadAssetUrl, {
    method: 'POST',
    headers: {
      Accept: GITHUB_API_MIME_TYPE,
      Authorization: `Bearer ${process.env['GHAPI_PAT']}`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': `${fs.statSync(fullAssetPath).size}`,
    },
    body: fs.createReadStream(fullAssetPath),
  });

  if (!response.ok) {
    throw new Error(
      `Error Uploading Asset:\n${JSON.stringify(response, null, 2)}`
    );
  }

  return (await response.json()) as GithubAsset;
}

/** Minimal interface for github release fields used. */
interface GithubRelease {
  id: string;
  assets_url: string;
}

/** Minimal interface for github asset fields used. */
interface GithubAsset {
  id: string;
  url: string;
  browser_download_url: string;
}

/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";

import extensionPackage from "../../package.json";
import { fetchNode } from "./fetch_node";

const KEYTAR_VERSION = extensionPackage.dependencies.keytar;

export const targetKeytarMap: Record<string, string> = {
  "linux-x64": `keytar-v${KEYTAR_VERSION}-napi-v3-linux-x64`,
  "linux-arm64": `keytar-v${KEYTAR_VERSION}-napi-v3-linux-arm64`,
  "linux-armhf": `keytar-v${KEYTAR_VERSION}-napi-v3-linux-ia32`,
  "alpine-x64": `keytar-v${KEYTAR_VERSION}-napi-v3-linuxmusl-x64`,
  "alpine-arm64": `keytar-v${KEYTAR_VERSION}-napi-v3-linuxmusl-arm64`,
  "darwin-x64": `keytar-v${KEYTAR_VERSION}-napi-v3-darwin-x64`,
  "darwin-arm64": `keytar-v${KEYTAR_VERSION}-napi-v3-darwin-arm64`,
  "win32-x64": `keytar-v${KEYTAR_VERSION}-napi-v3-win32-x64`,
};

export const fetchKeytar = async (target: string): Promise<string> => {
  const file = targetKeytarMap[target];
  const url = `https://github.com/atom/node-keytar/releases/download/v${KEYTAR_VERSION}/${file}.tar.gz`;
  const directoryPath = path.resolve(
    path.join("third_party", "github.com", "atom", "node-keytar")
  );
  fs.mkdirSync(directoryPath, { recursive: true });
  const filePath = path.join(directoryPath, `${file}.node`);

  await fetchNode(filePath, url);

  return filePath;
};

/*
 * Copyright 2021 Google LLC
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
import fs from "fs";

export interface NpmPackage {
  dependencies?: Record<string, string>;
  homepage?: string;
  license?: string;
  repo?: string;
  repository?: {
    baseUrl?: string;
    url?: string;
  };
}

export function readPackageJson(path: string): NpmPackage {
  try {
    const fileBuffer = fs.readFileSync(path, "utf8");
    return JSON.parse(fileBuffer);
  } catch (error) {
    console.warn("Could not read package.json", error.message);
  }
  return {};
}

export function getDependencies(rootPackageJson: string): string[] {
  const rootPackage = readPackageJson(rootPackageJson);
  return Object.keys(rootPackage.dependencies || {}) || [];
}

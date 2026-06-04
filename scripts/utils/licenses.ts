/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import fs from 'fs';
import {errorMessage} from './errors';

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
    const fileBuffer = fs.readFileSync(path, 'utf8');
    return JSON.parse(fileBuffer);
  } catch (error) {
    console.warn('Could not read package.json', errorMessage(error));
  }
  return {};
}

export function getDependencies(rootPackageJson: string): string[] {
  const rootPackage = readPackageJson(rootPackageJson);
  return Object.keys(rootPackage.dependencies || {}) || [];
}

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy-connections';
import '@malloydata/db-publisher';
import {
  ConnectionFactory,
  MalloyConfigResult,
} from '../../../common/connections/types';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {fileURLToPath} from 'url';

export class NodeConnectionFactory implements ConnectionFactory {
  reset() {
    // No-op: connections are now created fresh per-operation via the registry.
  }

  getWorkingDirectory(url: URL): string {
    try {
      const baseUrl = new URL('.', url);
      const fileUrl = new URL(baseUrl.pathname, 'file:');
      return fileURLToPath(fileUrl);
    } catch {
      return '.';
    }
  }

  findMalloyConfig(
    fileURL: URL,
    workspaceRoots: string[],
    globalConfigDirectory = ''
  ): MalloyConfigResult | undefined {
    let fileDir: string;
    try {
      const filePath = fileURLToPath(fileURL);
      fileDir = path.dirname(filePath);
    } catch {
      return undefined;
    }

    // Find the workspace root that contains this file, or fall back
    // to the file's own directory if there are no workspace roots.
    const normalizedRoots = workspaceRoots.map(r => path.resolve(r));
    const normalizedFileDir = path.resolve(fileDir);
    const root =
      normalizedRoots.find(
        r =>
          normalizedFileDir.startsWith(r + path.sep) || normalizedFileDir === r
      ) ?? normalizedFileDir;

    // 1. Workspace config: malloy-config.json at the workspace root
    const workspaceConfigPath = path.join(root, 'malloy-config.json');
    try {
      const configText = fs.readFileSync(workspaceConfigPath, 'utf-8');
      const manifestText = this.readManifestFile(configText, root);
      return {configText, configDir: root, manifestText};
    } catch {
      // Not found in workspace, try global
    }

    // 2. Global config directory fallback
    if (globalConfigDirectory) {
      const expandedDir = globalConfigDirectory.replace(/^~/, os.homedir());
      const globalConfigPath = path.join(expandedDir, 'malloy-config.json');
      try {
        const configText = fs.readFileSync(globalConfigPath, 'utf-8');
        const manifestText = this.readManifestFile(configText, expandedDir);
        return {configText, configDir: expandedDir, manifestText};
      } catch {
        // Not found
      }
    }

    return undefined;
  }

  private readManifestFile(
    configText: string,
    configDir: string
  ): string | undefined {
    let manifestPath = 'MANIFESTS';
    try {
      const parsed = JSON.parse(configText);
      if (typeof parsed.manifestPath === 'string') {
        manifestPath = parsed.manifestPath;
      }
    } catch {
      // If config JSON is invalid, use default manifest path
    }

    const manifestFile = path.join(
      configDir,
      manifestPath,
      'malloy-manifest.json'
    );
    try {
      return fs.readFileSync(manifestFile, 'utf-8');
    } catch {
      return undefined;
    }
  }
}

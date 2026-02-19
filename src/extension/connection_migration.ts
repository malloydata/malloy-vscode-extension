/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import {UnresolvedConnectionConfigEntry} from '../common/types/connection_manager_types';
import {malloyLog} from './logger';

interface LegacyConnectionEntry {
  name?: string;
  id?: string;
  backend?: string;
  additionalExtensions?: string[];
  [key: string]: unknown;
}

/**
 * Convert a legacy connections array to the new object format.
 * Returns the converted object plus log messages.
 */
export function convertLegacyConnections(legacy: LegacyConnectionEntry[]): {
  connections: Record<string, UnresolvedConnectionConfigEntry>;
  logs: string[];
  warnings: string[];
} {
  const connections: Record<string, UnresolvedConnectionConfigEntry> = {};
  const logs: string[] = [];
  const warnings: string[] = [];
  const seenNames = new Set<string>();

  for (let i = 0; i < legacy.length; i++) {
    const entry = legacy[i];
    const backend = entry.backend ?? 'unknown';

    // Drop GizmoSQL entries
    if (backend === 'gizmosql') {
      warnings.push(`Dropped GizmoSQL entry '${entry.name ?? `unnamed-${i}`}'`);
      continue;
    }

    // Determine name
    let name = entry.name;
    if (!name) {
      name = `${backend}-${i}`;
      logs.push(`Generated name '${name}' for unnamed ${backend} entry`);
    }

    // Handle duplicate names
    if (seenNames.has(name)) {
      warnings.push(
        `Dropped duplicate entry '${name}' (${backend}) — keeping first occurrence`
      );
      continue;
    }
    seenNames.add(name);

    // Build new entry
    const newEntry: UnresolvedConnectionConfigEntry = {is: backend};
    for (const [key, value] of Object.entries(entry)) {
      if (key === 'name' || key === 'id' || key === 'backend') {
        continue;
      }
      // Convert additionalExtensions from string[] to comma-separated string
      if (key === 'additionalExtensions' && Array.isArray(value)) {
        newEntry[key] = value.join(',');
        continue;
      }
      // Convert $secret-*$ placeholders to {secretKey: ...} references
      // Use the UUID-based key (entry.id) to match existing keychain entries
      if (
        typeof value === 'string' &&
        value.startsWith('$secret-') &&
        value.endsWith('$')
      ) {
        const keychainId = entry.id ?? name;
        newEntry[key] = {secretKey: `connections.${keychainId}.${key}`};
        continue;
      }
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        newEntry[key] = value;
      }
    }

    connections[name] = newEntry;
    logs.push(`Converted '${name}' (${backend})`);
  }

  return {connections, logs, warnings};
}

/**
 * Migrate a single settings scope (global or workspace).
 * Writes to `malloy.connectionMap`, leaving `malloy.connections` untouched.
 * Returns true if migration was performed.
 */
async function migrateScope(
  malloyConfig: vscode.WorkspaceConfiguration,
  connectionMapValue: unknown,
  connectionsValue: unknown,
  target: vscode.ConfigurationTarget,
  scopeName: string
): Promise<{migrated: boolean; count: number; warnings: string[]}> {
  // Already migrated — connectionMap exists in this scope
  if (connectionMapValue !== undefined) {
    return {migrated: false, count: 0, warnings: []};
  }

  // Nothing to migrate — no legacy array in this scope
  if (!Array.isArray(connectionsValue)) {
    return {migrated: false, count: 0, warnings: []};
  }

  const {connections, logs, warnings} =
    convertLegacyConnections(connectionsValue);

  // Write to connectionMap — legacy array is left untouched
  await malloyConfig.update('connectionMap', connections, target);

  // Log details
  for (const log of logs) {
    malloyLog.appendLine(`[migration:${scopeName}] ${log}`);
  }
  for (const warning of warnings) {
    malloyLog.appendLine(`[migration:${scopeName}] WARNING: ${warning}`);
  }

  return {migrated: true, count: Object.keys(connections).length, warnings};
}

/**
 * Run connection settings migration on extension activation.
 * Converts legacy `malloy.connections` array to `malloy.connectionMap` object.
 * The legacy array is never modified (safe for extension downgrade).
 */
export async function migrateConnectionSettings(): Promise<void> {
  const malloyConfig = vscode.workspace.getConfiguration('malloy');
  const connectionsInspection = malloyConfig.inspect('connections');
  const connectionMapInspection = malloyConfig.inspect('connectionMap');

  let totalCount = 0;
  const allWarnings: string[] = [];

  // Migrate global scope
  const globalResult = await migrateScope(
    malloyConfig,
    connectionMapInspection?.globalValue,
    connectionsInspection?.globalValue,
    vscode.ConfigurationTarget.Global,
    'global'
  );
  if (globalResult.migrated) {
    totalCount += globalResult.count;
    allWarnings.push(...globalResult.warnings);
  }

  // Migrate workspace scope
  const workspaceResult = await migrateScope(
    malloyConfig,
    connectionMapInspection?.workspaceValue,
    connectionsInspection?.workspaceValue,
    vscode.ConfigurationTarget.Workspace,
    'workspace'
  );
  if (workspaceResult.migrated) {
    totalCount += workspaceResult.count;
    allWarnings.push(...workspaceResult.warnings);
  }

  if (!globalResult.migrated && !workspaceResult.migrated) {
    return;
  }

  // Notify user
  const message = `Migrated ${totalCount} connection(s) to new format. See Malloy output for details.`;
  if (allWarnings.length > 0) {
    void vscode.window.showWarningMessage(message);
  } else {
    void vscode.window.showInformationMessage(message);
  }
}

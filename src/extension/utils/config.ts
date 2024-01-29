/*
 * Copyright 2024 Google LLC
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

import * as vscode from 'vscode';
import {
  BigQueryConnectionConfig,
  ConnectionBackend,
  ConnectionConfig,
} from '../../common/types/connection_manager_types';

/**
 * Centralized place to pull configuration for Malloy extension
 *
 * @returns Malloy config (vscode.WorkspaceConfiguration)
 */
export const getMalloyConfig = (): vscode.WorkspaceConfiguration => {
  const malloyConfig = vscode.workspace.getConfiguration('malloy');

  // possibly update bigquery config parameters
  const connectionConfigs = malloyConfig.get(
    'connections'
  ) as ConnectionConfig[];

  // if bigquery connection config still uses old "projectName" key,
  // move over to "projectId", delete the "projectName" key, and save
  connectionConfigs.forEach(connectionConfig => {
    if (connectionConfig.backend === ConnectionBackend.BigQuery) {
      const oldProjectNameValue = (
        connectionConfig as BigQueryConnectionConfig & {projectName?: string}
      ).projectName;

      if (oldProjectNameValue) {
        connectionConfig.projectId = oldProjectNameValue;
        delete (
          connectionConfig as BigQueryConnectionConfig & {projectName?: string}
        ).projectName;

        const hasWorkspaceConfig =
          malloyConfig.inspect('connections')?.workspaceValue !== undefined;

        malloyConfig.update(
          'connections',
          connectionConfigs,
          vscode.ConfigurationTarget.Global
        );
        if (hasWorkspaceConfig) {
          malloyConfig.update(
            'connections',
            connectionConfigs,
            vscode.ConfigurationTarget.Workspace
          );
        }
      }
    }
  });

  return malloyConfig;
};

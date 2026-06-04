/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  ConnectionConfigManager,
  UnresolvedConnectionConfigEntry,
} from '../common/types/connection_manager_types';
import {noAwait} from '../util/no_await';
import {getMalloyConfig} from './utils/config';

const getConnectionsSettingValue = ():
  | Record<string, UnresolvedConnectionConfigEntry>
  | undefined => {
  const malloyConfig = getMalloyConfig();
  const connectionMap = malloyConfig.get('connectionMap');
  if (connectionMap && typeof connectionMap === 'object') {
    return connectionMap as Record<string, UnresolvedConnectionConfigEntry>;
  }
  return undefined;
};

export class ConnectionConfigManagerBase implements ConnectionConfigManager {
  private config: Record<string, UnresolvedConnectionConfigEntry> | undefined;

  constructor() {
    noAwait(this.onConfigurationUpdated());
  }

  public getConnectionsConfig():
    | Record<string, UnresolvedConnectionConfigEntry>
    | undefined {
    return this.config;
  }

  async onConfigurationUpdated(): Promise<void> {
    this.config = getConnectionsSettingValue();
  }
}

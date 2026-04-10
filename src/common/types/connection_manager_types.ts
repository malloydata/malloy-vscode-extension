/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  Connection,
  JsonConfigValue,
  LookupConnection,
  MalloyConfig,
} from '@malloydata/malloy';

/**
 * A ConnectionConfigEntry that may contain unresolved {secretKey: ...} values.
 * These are resolved lazily by the settings wrapper before being passed
 * to MalloyConfig for connection creation.
 */
export type UnresolvedConnectionConfigEntry = {
  is: string;
  [key: string]:
    | string
    | number
    | boolean
    | JsonConfigValue
    | {env: string}
    | {secretKey: string}
    | undefined;
};

export interface ConnectionConfigManager {
  /** Returns new-format connection configs. */
  getConnectionsConfig():
    | Record<string, UnresolvedConnectionConfigEntry>
    | undefined;
  onConfigurationUpdated(): Promise<void>;
}

export interface ConnectionManager {
  getConnectionLookup(fileURL: URL): Promise<LookupConnection<Connection>>;
  setConnectionsConfig(
    connectionsConfig: Record<string, UnresolvedConnectionConfigEntry>
  ): void;
  getConfigForFile(fileURL: URL): Promise<MalloyConfig>;
}

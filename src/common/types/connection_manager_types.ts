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

import {BuildManifest, Connection, LookupConnection} from '@malloydata/malloy';

/**
 * A ConnectionConfigEntry that may contain unresolved {secretKey: ...} values.
 * These are resolved lazily by SettingsConnectionLookup before being passed
 * to MalloyConfig for connection creation.
 */
export type UnresolvedConnectionConfigEntry = {
  is: string;
  [key: string]:
    | string
    | number
    | boolean
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
  getConnectionLookup(fileURL: URL): LookupConnection<Connection>;
  setConnectionsConfig(
    connectionsConfig: Record<string, UnresolvedConnectionConfigEntry>
  ): void;
  getBuildManifest(fileURL: URL): BuildManifest | undefined;
}

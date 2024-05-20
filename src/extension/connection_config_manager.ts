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

import {
  ConnectionBackend,
  ConnectionConfig,
  ConnectionConfigManager,
} from '../common/types/connection_manager_types';
import {noAwait} from '../util/no_await';
import {getMalloyConfig} from './utils/config';

const getConnectionsConfig = (): ConnectionConfig[] => {
  const malloyConfig = getMalloyConfig();
  const connectionConfig = malloyConfig.get<ConnectionConfig[]>('connections');
  console.info('Using connection config', connectionConfig);
  return connectionConfig || [];
};

export abstract class ConnectionConfigManagerBase
  implements ConnectionConfigManager
{
  private configList: ConnectionConfig[] = [];

  constructor() {
    noAwait(this.onConfigurationUpdated());
  }

  public abstract getAvailableBackends(): ConnectionBackend[];

  public getAllConnectionConfigs() {
    return this.configList;
  }

  public getConnectionConfigs() {
    return this.filterUnavailableConnectionBackends(this.configList);
  }

  protected filterUnavailableConnectionBackends(
    connectionsConfig: ConnectionConfig[]
  ): ConnectionConfig[] {
    const availableBackends = this.getAvailableBackends();
    return connectionsConfig.filter(config =>
      availableBackends.includes(config.backend)
    );
  }

  public setConnectionsConfig(connectionsConfig: ConnectionConfig[]): void {
    // Force existing connections to be regenerated
    console.info('Using connection config', connectionsConfig);
    this.configList = connectionsConfig;
  }

  async onConfigurationUpdated(): Promise<void> {
    return this.setConnectionsConfig(getConnectionsConfig());
  }
}

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

import {ConnectionManager} from '../common/connection_manager';
import {ConnectionConfig} from '../common/types/connection_manager_types';
import {ConnectionFactory} from '../common/connections/types';
import {getMalloyConfig} from './utils/config';

const DEFAULT_ROW_LIMIT = 50;

const getConnectionsConfig = (): ConnectionConfig[] => {
  const malloyConfig = getMalloyConfig();
  const connectionConfig = malloyConfig.get<ConnectionConfig[]>('connections');
  console.info('Using connection config', connectionConfig);
  return connectionConfig || [];
};

export class VSCodeConnectionManager extends ConnectionManager {
  constructor(connectionFactory: ConnectionFactory) {
    super(connectionFactory, getConnectionsConfig());
  }

  async onConfigurationUpdated(): Promise<void> {
    return this.setConnectionsConfig(getConnectionsConfig());
  }

  override getCurrentRowLimit(): number {
    // We get the `rowLimit` setting in this subclass instead of in the base class,
    // because the Language Server doesn't actually care about row limits, because it never
    // runs queries, and because it's slightly harder to get settings from within the language
    // server.
    const rowLimitRaw = getMalloyConfig().get('rowLimit');
    if (rowLimitRaw === undefined) {
      return DEFAULT_ROW_LIMIT;
    }
    if (typeof rowLimitRaw === 'string') {
      try {
        return parseInt(rowLimitRaw);
      } catch (_error) {
        return DEFAULT_ROW_LIMIT;
      }
    }
    if (typeof rowLimitRaw !== 'number') {
      return DEFAULT_ROW_LIMIT;
    }
    return rowLimitRaw;
  }
}

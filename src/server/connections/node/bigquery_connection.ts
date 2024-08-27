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

import {BigQueryConnection} from '@malloydata/db-bigquery';
import {
  ConfigOptions,
  BigQueryConnectionConfig,
} from '../../../common/types/connection_manager_types';
import {convertToBytes} from '../../../common/convert_to_bytes';

export const createBigQueryConnection = async (
  connectionConfig: BigQueryConnectionConfig,
  {rowLimit}: ConfigOptions
): Promise<BigQueryConnection> => {
  const options = {
    projectId: connectionConfig.projectId,
    billingProjectId: connectionConfig.billingProjectId,
    serviceAccountKeyPath: connectionConfig.serviceAccountKeyPath,
    location: connectionConfig.location,
    maximumBytesBilled: convertToBytes(
      connectionConfig.maximumBytesBilled || ''
    ),
    timeoutMs: connectionConfig.timeoutMs,
  };
  console.info('Creating bigquery connection with', JSON.stringify(options));
  const connection = new BigQueryConnection(
    connectionConfig.name,
    () => ({
      rowLimit,
    }),
    options
  );
  return connection;
};

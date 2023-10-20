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

import {MessageConfig} from '../../common/worker_message_types';
import {ConnectionManager} from '../../common/connection_manager';

const DEFAULT_ROW_LIMIT = 50;

export const refreshConfig = (
  connectionManager: ConnectionManager,
  {malloy, cloudcode}: MessageConfig
): void => {
  const {rowLimit: rowLimitRaw, connections} = malloy;

  console.info('Config updated');

  connectionManager.setConnectionsConfig(connections);
  const rowLimit = rowLimitRaw || DEFAULT_ROW_LIMIT;
  connectionManager.setCurrentRowLimit(+rowLimit);

  const cloudCodeProject = cloudcode.project;
  const cloudShellProject = cloudcode.cloudshell?.project;

  const project = cloudCodeProject || cloudShellProject;

  if (project && typeof project === 'string') {
    process.env['DEVSHELL_PROJECT_ID'] = project;
    process.env['GOOGLE_CLOUD_PROJECT'] = project;
    process.env['GOOGLE_CLOUD_QUOTA_PROJECT'] = project;
  }
};

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

import * as React from 'react';
import {VSCodeButton, VSCodeTextField} from '@vscode/webview-ui-toolkit/react';
import {BigQueryConnectionConfig} from '../../../../common/types/connection_manager_types';
import {ConnectionEditorTable} from './ConnectionEditorTable';

export interface BigQueryConnectionEditorProps {
  config: BigQueryConnectionConfig;
  setConfig: (config: BigQueryConnectionConfig) => void;
  requestFilePath: (
    connectionId: string,
    configKey: string,
    filters: {[key: string]: string[]}
  ) => void;
}

export const BigQueryConnectionEditor = ({
  config,
  setConfig,
  requestFilePath,
}: BigQueryConnectionEditorProps) => {
  const requestServiceAccountKeyPath = () => {
    requestFilePath(config.id, 'serviceAccountKeyPath', {
      JSON: ['json'],
    });
  };

  return (
    <ConnectionEditorTable>
      <tbody>
        <tr>
          <td className="label-cell">
            <label>Name:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.name}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, name: value});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Default Project ID:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.projectId || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, projectId: value});
              }}
              placeholder="Optional"
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Billing Project ID:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.billingProjectId || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, billingProjectId: value});
              }}
              placeholder="Optional"
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Location:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.location || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, location: value});
              }}
              placeholder="Optional (default US)"
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Service Account Key File Path:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.serviceAccountKeyPath || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, serviceAccountKeyPath: value});
              }}
              placeholder="Optional"
            ></VSCodeTextField>
          </td>
          <td>
            <VSCodeButton onClick={requestServiceAccountKeyPath}>
              Pick File
            </VSCodeButton>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Maximum Bytes Billed:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.maximumBytesBilled || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, maximumBytesBilled: value});
              }}
              placeholder="Optional"
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Query Timeout Milliseconds:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.timeoutMs || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, timeoutMs: value});
              }}
              placeholder="Optional"
            ></VSCodeTextField>
          </td>
        </tr>
      </tbody>
    </ConnectionEditorTable>
  );
};

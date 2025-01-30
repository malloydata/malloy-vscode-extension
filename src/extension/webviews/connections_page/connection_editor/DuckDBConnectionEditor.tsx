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
import {DuckDBConnectionConfig} from '../../../../common/types/connection_manager_types';
import {SecretEditor} from './components/SecretEditor';

export interface DuckDBConnectionEditorProps {
  config: DuckDBConnectionConfig;
  setConfig: (config: DuckDBConnectionConfig) => void;
  requestFilePath: (
    connectionId: string,
    configKey: string,
    filters: {[key: string]: string[]}
  ) => void;
}

export const DuckDBConnectionEditor = ({
  config,
  setConfig,
  requestFilePath,
}: DuckDBConnectionEditorProps) => {
  const requestDatabasePath = () => {
    requestFilePath(config.id, 'databasePath', {
      DuckDB: ['.db', '.duckdb', '.ddb'],
    });
  };

  return (
    <table>
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
            <label>Working Directory:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.workingDirectory || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, workingDirectory: value});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Database File:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.databasePath || ''}
              placeholder=":memory:"
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, databasePath: value});
              }}
            ></VSCodeTextField>
          </td>
          <td>
            <VSCodeButton onClick={requestDatabasePath}>Pick File</VSCodeButton>
          </td>
        </tr>
        {config.databasePath?.startsWith('md:') ? (
          <tr>
            <td className="label-cell">
              <label>MotherDuck Token:</label>
            </td>
            <td>
              <SecretEditor
                secret={config.motherDuckToken}
                setSecret={(secret: string) => {
                  setConfig({...config, motherDuckToken: secret});
                }}
              ></SecretEditor>
            </td>
          </tr>
        ) : null}
        <tr>
          <td className="label-cell">
            <label>Additional Extensions:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.additionalExtensions?.join(',') || ''}
              placeholder="ext1, ext2"
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({
                  ...config,
                  additionalExtensions: value.split(/\s*,\s*/g),
                });
              }}
            ></VSCodeTextField>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

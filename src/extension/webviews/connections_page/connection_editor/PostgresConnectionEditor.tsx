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
import {VSCodeTextField} from '@vscode/webview-ui-toolkit/react';
import {PostgresConnectionConfig} from '../../../../common/types/connection_manager_types';
import {SecretEditor} from './components/SecretEditor';
import {ConnectionEditorTable} from './ConnectionEditorTable';

export interface PostgresConnectionEditorProps {
  config: PostgresConnectionConfig;
  setConfig: (config: PostgresConnectionConfig) => void;
}

export const PostgresConnectionEditor = ({
  config,
  setConfig,
}: PostgresConnectionEditorProps) => {
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
            <label>Host:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.host || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, host: value});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Port:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.port ? config.port.toString() : ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, port: parseInt(value)});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Database Name:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.databaseName || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, databaseName: value});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Username:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.username || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, username: value});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Password:</label>
          </td>
          <td>
            <SecretEditor
              secret={config.password}
              setSecret={(secret: string) => {
                setConfig({...config, password: secret});
              }}
            ></SecretEditor>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>
              {' '}
              Connection URL <i>(Advanced)</i>:{' '}
            </label>
          </td>
          <td>
            <VSCodeTextField
              style={{width: '40em'}}
              value={config.connectionString || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, connectionString: value});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
      </tbody>
    </ConnectionEditorTable>
  );
};

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
import {useState} from 'react';
import {
  VSCodeCheckbox,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import {SnowflakeConnectionConfig} from '../../../../common/types/connection_manager_types';
import {ConnectionEditorTable} from './ConnectionEditorTable';
import {SecretEditor} from './components/SecretEditor';

export interface SnowflakeConnectionEditorProps {
  config: SnowflakeConnectionConfig;
  setConfig: (config: SnowflakeConnectionConfig) => void;
}

export const SnowflakeConnectionEditor = ({
  config,
  setConfig,
}: SnowflakeConnectionEditorProps) => {
  const [showPassword, setShowPassword] = useState(false);

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
            <label>Account:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.account || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, account: value});
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
            />
          </td>
          <td style={{paddingLeft: '10px'}}>
            <VSCodeCheckbox
              checked={showPassword}
              onChange={({target}) => {
                const checked = (target as HTMLInputElement).checked;
                setShowPassword(checked);
              }}
            >
              Show Password
            </VSCodeCheckbox>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Warehouse:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.warehouse || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, warehouse: value});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Database:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.database || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, database: value});
              }}
              placeholder="Optional"
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Schema:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.schema || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, schema: value});
              }}
              placeholder="Optional"
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Response Timeout:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.timeoutMs ? config.timeoutMs.toString() : ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, timeoutMs: parseInt(value)});
              }}
              placeholder="Optional"
            ></VSCodeTextField>
          </td>
        </tr>
      </tbody>
    </ConnectionEditorTable>
  );
};

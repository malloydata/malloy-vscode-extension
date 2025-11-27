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
import {GizmoSQLConnectionConfig} from '../../../../common/types/connection_manager_types';
import {SecretEditor} from './components/SecretEditor';

export interface GizmoSQLConnectionEditorProps {
  config: GizmoSQLConnectionConfig;
  setConfig: (config: GizmoSQLConnectionConfig) => void;
}

export const GizmoSQLConnectionEditor = ({
  config,
  setConfig,
}: GizmoSQLConnectionEditorProps) => {
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
            <label>URI:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.gizmosqlUri || ''}
              placeholder="grpc+tls://host:port"
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, gizmosqlUri: value});
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
              value={config.gizmosqlUsername || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, gizmosqlUsername: value});
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
              secret={config.gizmosqlPassword}
              setSecret={(secret: string) => {
                setConfig({...config, gizmosqlPassword: secret});
              }}
            ></SecretEditor>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Catalog:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.gizmosqlCatalog || ''}
              placeholder="main"
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, gizmosqlCatalog: value});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

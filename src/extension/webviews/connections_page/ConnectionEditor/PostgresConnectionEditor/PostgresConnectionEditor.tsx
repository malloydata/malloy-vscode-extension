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

import {TextFieldType} from '@vscode/webview-ui-toolkit';
import React, {useState} from 'react';
import {PostgresConnectionConfig} from '../../../../../common/connection_manager_types';
import {TextField} from '../../../components';
import {VSCodeCheckbox, VSCodeRadio} from '@vscode/webview-ui-toolkit/react';
import {Label} from '../Label';
import {LabelCell} from '../LabelCell';

interface PostgresConnectionEditorProps {
  config: PostgresConnectionConfig;
  setConfig: (config: PostgresConnectionConfig) => void;
}

export const PostgresConnectionEditor: React.FC<
  PostgresConnectionEditorProps
> = ({config, setConfig}) => {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <table>
      <tbody>
        <tr>
          <LabelCell>
            <Label>Name:</Label>
          </LabelCell>
          <td>
            <TextField
              value={config.name}
              setValue={name => {
                setConfig({...config, name});
              }}
            />
          </td>
        </tr>
        <tr>
          <LabelCell>
            <Label>Host:</Label>
          </LabelCell>
          <td>
            <TextField
              value={config.host || ''}
              setValue={host => {
                setConfig({...config, host});
              }}
            ></TextField>
          </td>
        </tr>
        <tr>
          <LabelCell>
            <Label>Port:</Label>
          </LabelCell>
          <td>
            <TextField
              value={config.port ? config.port.toString() : ''}
              setValue={port => {
                setConfig({...config, port: parseInt(port)});
              }}
            ></TextField>
          </td>
        </tr>
        <tr>
          <LabelCell>
            <Label>Database Name:</Label>
          </LabelCell>
          <td>
            <TextField
              value={config.databaseName || ''}
              setValue={databaseName => {
                setConfig({...config, databaseName});
              }}
            ></TextField>
          </td>
        </tr>
        <tr>
          <LabelCell>
            <Label>Username:</Label>
          </LabelCell>
          <td>
            <TextField
              value={config.username || ''}
              setValue={username => {
                setConfig({...config, username});
              }}
            />
          </td>
        </tr>
        <tr>
          <LabelCell>
            <Label>Password:</Label>
          </LabelCell>
          <td>
            {config.useKeychainPassword !== undefined && (
              <div>
                <VSCodeRadio
                  value="keychain"
                  checked={config.useKeychainPassword}
                  onChange={event => {
                    if (event.target?.checked) {
                      setConfig({
                        ...config,
                        password: undefined,
                        useKeychainPassword: true,
                      });
                    }
                  }}
                >
                  Use existing value
                </VSCodeRadio>
              </div>
            )}
            <div>
              <VSCodeRadio
                value="none"
                key="none"
                checked={
                  !config.useKeychainPassword && config.password === undefined
                }
                onChange={event => {
                  if (event.target?.checked) {
                    setConfig({
                      ...config,
                      password: undefined,
                      useKeychainPassword:
                        config.useKeychainPassword === undefined
                          ? undefined
                          : false,
                    });
                  }
                }}
              >
                No password
              </VSCodeRadio>
            </div>
            <div>
              <VSCodeRadio
                value="specified"
                key="specified"
                checked={config.password !== undefined}
                onChange={event => {
                  if (event.target?.checked) {
                    setConfig({
                      ...config,
                      password: '',
                      useKeychainPassword:
                        config.useKeychainPassword === undefined
                          ? undefined
                          : false,
                    });
                  }
                }}
              >
                Enter a password
                {config.password !== undefined && ':'}
              </VSCodeRadio>
            </div>
          </td>
        </tr>
        {config.password !== undefined && (
          <tr>
            <td></td>
            <td>
              <TextField
                value={config.password}
                setValue={password => {
                  setConfig({
                    ...config,
                    password,
                  });
                }}
                type={
                  showPassword ? TextFieldType.text : TextFieldType.password
                }
                placeholder="Optional"
              />
            </td>
            <td style={{paddingLeft: '10px'}}>
              <VSCodeCheckbox
                checked={showPassword}
                onChange={event => {
                  setShowPassword(event.target?.checked);
                }}
              >
                Show Password
              </VSCodeCheckbox>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

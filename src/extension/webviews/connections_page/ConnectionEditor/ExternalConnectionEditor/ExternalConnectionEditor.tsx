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

import React from 'react';
import {
  ExternalConnectionConfig,
  ExternalConnectionSource,
  ExternalConnectionSourceNames,
} from '../../../../../common/connection_manager_types';
import {Dropdown, TextField, VSCodeButton} from '../../../components';
import {Label} from '../Label';
import {LabelCell} from '../LabelCell';
import {ButtonGroup} from '../../ButtonGroup';
import {ConnectionMessageInstallExternalConnection} from '../../../../../common/message_types';
import {TextFieldType} from '@vscode/webview-ui-toolkit';
import {ConnectionConfig, ConnectionParameterValue} from '@malloydata/malloy';

interface ExternalConnectionEditorProps {
  config: ExternalConnectionConfig;
  setConfig: (config: ExternalConnectionConfig) => void;
  installExternalConnection: (config: ExternalConnectionConfig) => void;
  installExternalConnectionStatus:
    | ConnectionMessageInstallExternalConnection
    | undefined;
}

export const ExternalConnectionEditor: React.FC<
  ExternalConnectionEditorProps
> = ({
  config,
  setConfig,
  installExternalConnection,
  installExternalConnectionStatus,
}) => {
  const allConnectionSources = [
    ExternalConnectionSource.NPM,
    ExternalConnectionSource.LocalNPM,
  ];

  const sourceOptions = allConnectionSources.map(value => ({
    value,
    label: ExternalConnectionSourceNames[value],
  }));

  if (!config.source) {
    config.source = ExternalConnectionSource.NPM;
  }

  if (
    installExternalConnectionStatus?.status === 'success' &&
    config.packageInfo !==
      installExternalConnectionStatus.connection.packageInfo
  ) {
    config.packageInfo = installExternalConnectionStatus.connection.packageInfo;
    config.connectionSchema =
      installExternalConnectionStatus.connection.connectionSchema;
    config.name = installExternalConnectionStatus.connection.name;
  }

  return (
    <table>
      <tbody>
        <tr>
          <LabelCell>
            <Label>Source:</Label>
          </LabelCell>
          <td>
            <Dropdown
              value={config.source!}
              setValue={(source: string) =>
                setConfig({
                  backend: config.backend,
                  isDefault: config.isDefault,
                  id: config.id,
                  name: config.name,
                  source: source as ExternalConnectionSource,
                })
              }
              options={sourceOptions}
            />
          </td>
        </tr>
        <tr>
          <LabelCell>
            <Label>Path:</Label>
          </LabelCell>
          <td>
            <TextField
              value={config.path || ''}
              setValue={path => {
                setConfig({
                  backend: config.backend,
                  isDefault: config.isDefault,
                  id: config.id,
                  name: config.name,
                  source: config.source,
                  path: path.trim(),
                });
              }}
            />
          </td>
        </tr>
        <tr>
          <td />
          <td>
            <ButtonGroup>
              <VSCodeButton
                disabled={shouldDisableInstallButton(
                  installExternalConnectionStatus,
                  config
                )}
                onClick={() => installExternalConnection(config)}
                appearance="secondary"
              >
                {installButtonLabel(installExternalConnectionStatus, config)}
              </VSCodeButton>
              {installExternalConnectionStatus?.status === 'error' &&
                installExternalConnectionStatus.error}
            </ButtonGroup>
          </td>
        </tr>
        {config.packageInfo && (
          <tr>
            <LabelCell>
              <Label>Name:</Label>
            </LabelCell>
            <td>
              <TextField
                value={config.name}
                setValue={value => {
                  setConfig({...config, name: value});
                }}
              />
            </td>
          </tr>
        )}
        {config.connectionSchema?.map(parameter => {
          // TODO(figutierrez): Move this to its own component.
          return (
            <tr key={parameter.label}>
              <LabelCell>
                <Label>{parameter.label}:</Label>
              </LabelCell>
              <td>
                <TextField
                  placeholder={
                    parameter.isOptional
                      ? `Optional ${
                          parameter.defaultValue
                            ? `(default ${parameter.defaultValue})`
                            : ''
                        }`
                      : ''
                  }
                  value={
                    (config.configParameters?.[parameter.name] || '') as string
                  }
                  setValue={value => {
                    const configParameters =
                      config.configParameters ?? ({} as ConnectionConfig);
                    let configParameterValue: ConnectionParameterValue = value;
                    if (parameter.type === 'number') {
                      try {
                        configParameterValue = parseInt(value);
                      } catch {
                        // TODO(figutierrez): Show error when this happens.
                        configParameterValue = 0;
                      }
                    } else if (parameter.type === 'boolean') {
                      configParameterValue = value === 'false';
                    }
                    configParameters[parameter.name] = configParameterValue;
                    setConfig({
                      ...config,
                      configParameters: configParameters,
                    });
                  }}
                  type={
                    parameter.isSecret
                      ? TextFieldType.password
                      : TextFieldType.text
                  }
                ></TextField>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const installButtonLabel = (
  installConnection: ConnectionMessageInstallExternalConnection | undefined,
  config: ExternalConnectionConfig
) => {
  if (installConnection?.status === 'waiting') {
    return 'Installing...';
  }

  if (config.packageInfo) {
    return 'Installed';
  }

  return 'Install Plugin';
};

const shouldDisableInstallButton = (
  installConnection: ConnectionMessageInstallExternalConnection | undefined,
  config: ExternalConnectionConfig
) => {
  if (installConnection?.status === 'waiting') {
    return true;
  }

  if ((config.path?.trim()?.length ?? 0) === 0) {
    return true;
  }

  if (config.packageInfo) {
    return true;
  }

  return false;
};

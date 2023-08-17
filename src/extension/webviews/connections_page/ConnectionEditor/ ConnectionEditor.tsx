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
import styled from 'styled-components';
import {
  ConnectionBackend,
  ConnectionBackendNames,
  ConnectionConfig,
  ExternalConnectionConfig,
} from '../../../../common/connection_manager_types';
import {
  ConnectionMessageInstallExternalConnection,
  ConnectionMessageTest,
} from '../../../../common/message_types';
import {Dropdown} from '../../components';
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeTag,
} from '@vscode/webview-ui-toolkit/react';
import {ButtonGroup} from '../ButtonGroup';
import {BigQueryConnectionEditor} from './BigQueryConnectionEditor';
import {Label} from './Label';
import {LabelCell} from './LabelCell';
import {PostgresConnectionEditor} from './PostgresConnectionEditor';
import {DuckDBConnectionEditor} from './DuckDBConnectionEditor';
import {ExternalConnectionEditor} from './ExternalConnectionEditor';

interface ConnectionEditorProps {
  config: ConnectionConfig;
  setConfig: (config: ConnectionConfig) => void;
  deleteConfig: () => void;
  testConfig: () => void;
  testStatus: ConnectionMessageTest | undefined;
  requestServiceAccountKeyPath: (connectionId: string) => void;
  isDefault: boolean;
  makeDefault: () => void;
  availableBackends: ConnectionBackend[];
  installExternalConnection: (config: ExternalConnectionConfig) => void;
  installExternalConnectionStatus:
    | ConnectionMessageInstallExternalConnection
    | undefined;
}

export const ConnectionEditor: React.FC<ConnectionEditorProps> = ({
  config,
  setConfig,
  deleteConfig,
  testConfig,
  testStatus,
  requestServiceAccountKeyPath,
  isDefault,
  makeDefault,
  availableBackends,
  installExternalConnection,
  installExternalConnectionStatus,
}) => {
  const allBackendOptions: ConnectionBackend[] = [
    ConnectionBackend.BigQuery,
    ConnectionBackend.Postgres,
    ConnectionBackend.DuckDB,
    ConnectionBackend.External,
  ];

  const backendOptions = allBackendOptions
    .filter(option => availableBackends.includes(option))
    .map(value => ({value, label: ConnectionBackendNames[value]}));

  return (
    <ConnectionEditorBox>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          justifyContent: 'space-between',
        }}
      >
        <ConnectionTitle>CONNECTION</ConnectionTitle>
        {isDefault && <VSCodeTag>Default</VSCodeTag>}
        {!isDefault && (
          <VSCodeButton onClick={makeDefault} style={{height: '25px'}}>
            Make Default
          </VSCodeButton>
        )}
      </div>
      <table>
        <tbody>
          <tr>
            <LabelCell>
              <Label>Type:</Label>
            </LabelCell>
            <td>
              <Dropdown
                value={config.backend}
                setValue={(backend: string) =>
                  setConfig({
                    name: config.name,
                    backend: backend as ConnectionBackend,
                    id: config.id,
                    isDefault: config.isDefault,
                  })
                }
                options={backendOptions}
              />
            </td>
          </tr>
        </tbody>
      </table>
      {config.backend === ConnectionBackend.BigQuery ? (
        <BigQueryConnectionEditor
          config={config}
          setConfig={setConfig}
          requestServiceAccountKeyPath={() =>
            requestServiceAccountKeyPath(config.id)
          }
        />
      ) : config.backend === ConnectionBackend.Postgres ? (
        <PostgresConnectionEditor config={config} setConfig={setConfig} />
      ) : config.backend === ConnectionBackend.DuckDB ? (
        <DuckDBConnectionEditor config={config} setConfig={setConfig} />
      ) : config.backend === ConnectionBackend.External ? (
        <ExternalConnectionEditor
          config={config}
          setConfig={setConfig}
          installExternalConnection={installExternalConnection}
          installExternalConnectionStatus={installExternalConnectionStatus}
        />
      ) : (
        <div>Unknown Connection Type</div>
      )}
      <VSCodeDivider />
      <table>
        <tbody>
          <tr>
            <LabelCell></LabelCell>
            <td>
              <ButtonGroup style={{marginTop: '5px'}}>
                <VSCodeButton onClick={deleteConfig} appearance="secondary">
                  Delete
                </VSCodeButton>
                <VSCodeButton onClick={testConfig}>Test</VSCodeButton>
                {testStatus && <VSCodeTag>{testStatus?.status}</VSCodeTag>}
                {testStatus?.status === 'error' && testStatus.error}
              </ButtonGroup>
            </td>
          </tr>
        </tbody>
      </table>
    </ConnectionEditorBox>
  );
};

const ConnectionEditorBox = styled.div`
  margin: 10px;
  background-color: var(--vscode-list-hoverBackground);
  padding: 10px;
  border: 1px solid var(--vscode-contrastBorder);
`;

const ConnectionTitle = styled.b`
  color: var(--foreground);
  font-family: var(--font-family);
`;

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
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTag,
} from '@vscode/webview-ui-toolkit/react';
import {
  ConnectionBackend,
  ConnectionBackendNames,
  ConnectionConfig,
} from '../../../../common/types/connection_manager_types';
import {ConnectionMessageTest} from '../../../../common/types/message_types';
import ChevronDownIcon from '../../assets/chevron_down.svg';
import {BigQueryConnectionEditor} from './BigQueryConnectionEditor';
import {DuckDBConnectionEditor} from './DuckDBConnectionEditor';
import {ConnectionEditorTable} from './ConnectionEditorTable';
import {PostgresConnectionEditor} from './PostgresConnectionEditor';
import {SnowflakeConnectionEditor} from './SnowflakeConnectionEditor';
import {TrinoPrestoConnectionEditor} from './TrinoPrestoConnectionEditor';
import {PublisherConnectionEditor} from './PublisherConnectionEditor';

interface ConnectionHeaderProps {
  config: {name?: string};
  setSelectedId: (id: any) => void;
}

const ConnectionHeader: React.FC<ConnectionHeaderProps> = ({
  config,
  setSelectedId,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        justifyContent: 'space-between',
      }}
    >
      <b className="connection-title" onClick={() => setSelectedId(null)}>
        <ChevronDownIcon width={16} height={16} />
        CONNECTION: {config.name || 'Untitled'}
      </b>
    </div>
  );
};

export interface ConnectionEditorProps {
  config: ConnectionConfig;
  setConfig: (config: ConnectionConfig) => void;
  deleteConfig: () => void;
  testConfig: () => void;
  testStatus: ConnectionMessageTest | undefined;
  requestFilePath: (
    connectionId: string,
    configKey: string,
    filters: {[key: string]: string[]}
  ) => void;
  availableBackends: ConnectionBackend[];
  setSelectedId: (id: string | null) => void;
}

export const ConnectionEditor = ({
  config,
  setConfig,
  deleteConfig,
  testConfig,
  testStatus,
  requestFilePath,
  availableBackends,
  setSelectedId,
}: ConnectionEditorProps) => {
  if ('readOnly' in config && config.readOnly) {
    return (
      <div className="connection-editor-box">
        <ConnectionHeader config={config} setSelectedId={setSelectedId} />
        <div className="read-only-message" style={{color: 'gray'}}>
          This connection is managed externally and cannot be modified.
        </div>
      </div>
    );
  }
  const allBackendOptions: ConnectionBackend[] = [
    ConnectionBackend.BigQuery,
    ConnectionBackend.Postgres,
    ConnectionBackend.DuckDB,
    ConnectionBackend.Snowflake,
    ConnectionBackend.Presto,
    ConnectionBackend.Trino,
    ConnectionBackend.Publisher,
  ];

  const backendOptions = allBackendOptions
    .filter(option => availableBackends.includes(option))
    .map(value => ({value, label: ConnectionBackendNames[value]}));

  return (
    <div className="connection-editor-box">
      <ConnectionHeader config={config} setSelectedId={setSelectedId} />
      <ConnectionEditorTable>
        <tbody>
          <tr>
            <td className="label-cell">
              <label>Type:</label>
            </td>
            <td>
              <VSCodeDropdown
                onChange={({target}) => {
                  const value = (target as HTMLInputElement).value;
                  const backend = value as ConnectionBackend;
                  setConfig({
                    ...config,
                    backend,
                  } as ConnectionConfig);
                }}
                value={config.backend}
              >
                {backendOptions.map(option => (
                  <VSCodeOption
                    key={option.value}
                    value={option.value}
                    selected={config.backend === option.value}
                  >
                    {option.label}
                  </VSCodeOption>
                ))}
              </VSCodeDropdown>
            </td>
          </tr>
        </tbody>
      </ConnectionEditorTable>
      {config.backend === ConnectionBackend.BigQuery ? (
        <BigQueryConnectionEditor
          config={config}
          setConfig={setConfig}
          requestFilePath={requestFilePath}
        ></BigQueryConnectionEditor>
      ) : config.backend === ConnectionBackend.Postgres ? (
        <PostgresConnectionEditor
          config={config}
          setConfig={setConfig}
        ></PostgresConnectionEditor>
      ) : config.backend === ConnectionBackend.DuckDB ? (
        <DuckDBConnectionEditor
          config={config}
          setConfig={setConfig}
          requestFilePath={requestFilePath}
        ></DuckDBConnectionEditor>
      ) : config.backend === ConnectionBackend.Snowflake ? (
        <SnowflakeConnectionEditor
          config={config}
          setConfig={setConfig}
        ></SnowflakeConnectionEditor>
      ) : config.backend === ConnectionBackend.Presto ||
        config.backend === ConnectionBackend.Trino ? (
        <TrinoPrestoConnectionEditor
          config={config}
          setConfig={setConfig}
        ></TrinoPrestoConnectionEditor>
      ) : config.backend === ConnectionBackend.Publisher ? (
        <PublisherConnectionEditor
          config={config}
          setConfig={setConfig}
        ></PublisherConnectionEditor>
      ) : (
        <div>Unknown Connection Type</div>
      )}
      <VSCodeDivider />
      <ConnectionEditorTable>
        <tbody>
          <tr>
            <td className="label-cell"></td>
            <td>
              <div className="button-group" style={{marginTop: '5px'}}>
                <VSCodeButton onClick={deleteConfig} appearance="secondary">
                  Delete
                </VSCodeButton>
                <VSCodeButton onClick={testConfig}>Test</VSCodeButton>
                {testStatus ? (
                  <VSCodeTag>{testStatus?.status}</VSCodeTag>
                ) : null}
                {testStatus?.status === 'error' ? testStatus.error : null}
              </div>
            </td>
          </tr>
        </tbody>
      </ConnectionEditorTable>
    </div>
  );
};

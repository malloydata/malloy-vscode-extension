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

import React, {useState} from 'react';
import styled from 'styled-components';
import {v4 as uuidv4} from 'uuid';
import {
  ConnectionBackend,
  ConnectionConfig,
  ExternalConnectionConfig,
  getDefaultIndex,
} from '../../../../common/connection_manager_types';
import {
  ConnectionMessageInstallExternalConnection,
  ConnectionMessageTest,
} from '../../../../common/message_types';
import {VSCodeButton} from '../../components';
import {ButtonGroup} from '../ButtonGroup';
import {ConnectionEditor} from '../ConnectionEditor';
import {
  ConnectionEditorBox,
  ConnectionTitle,
} from '../ConnectionEditor/ConnectionTitle';

interface ConnectionEditorListProps {
  connections: ConnectionConfig[];
  setConnections: (connections: ConnectionConfig[], isNew?: boolean) => void;
  saveConnections: () => void;
  testConnection: (connection: ConnectionConfig) => void;
  testStatuses: ConnectionMessageTest[];
  requestServiceAccountKeyPath: (connectionId: string) => void;
  availableBackends: ConnectionBackend[];
  installExternalConnection: (config: ExternalConnectionConfig) => void;
  installExternalConnectionStatuses: ConnectionMessageInstallExternalConnection[];
  selectedId: string | null;
  setSelectedId: (selectedId: string | null) => void;
}

export const ConnectionEditorList: React.FC<ConnectionEditorListProps> = ({
  connections,
  setConnections,
  saveConnections,
  testConnection,
  testStatuses,
  requestServiceAccountKeyPath,
  availableBackends,
  installExternalConnection,
  installExternalConnectionStatuses,
  selectedId,
  setSelectedId,
}) => {
  const [dirty, setDirty] = useState(false);
  const defaultConnectionIndex = getDefaultIndex(connections);

  const addConnection = () => {
    const id = uuidv4();
    setConnections([
      ...connections,
      {
        name: '',
        backend: availableBackends[0],
        id,
        isDefault: connections.length === 0,
      },
    ]);
    setSelectedId(id);
  };

  const setConfig = (config: ConnectionConfig, index: number) => {
    const copy = [...connections];
    config.isGenerated = false;
    copy[index] = config;
    setConnections(copy);
    setDirty(true);
  };

  const makeDefault = (defaultIndex: number) => {
    const newConnections = connections.map((connection, index) => {
      return {...connection, isDefault: index === defaultIndex};
    });
    setConnections(newConnections);
    setDirty(true);
  };

  return (
    <div style={{marginTop: '20px'}}>
      <ButtonGroup style={{margin: '10px'}}>
        <VSCodeButton onClick={addConnection}>New Connection</VSCodeButton>
      </ButtonGroup>
      {connections.map((config, index) =>
        selectedId === config.id ? (
          <ConnectionEditor
            key={index}
            config={config}
            setConfig={newConfig => setConfig(newConfig, index)}
            deleteConfig={() => {
              const copy = [...connections];
              copy.splice(index, 1);
              setConnections(copy);
              setDirty(true);
            }}
            testConfig={() => {
              testConnection(connections[index]);
            }}
            testStatus={[...testStatuses]
              .reverse()
              .find(message => message.connection.id === config.id)}
            requestServiceAccountKeyPath={requestServiceAccountKeyPath}
            isDefault={index === defaultConnectionIndex}
            makeDefault={() => makeDefault(index)}
            availableBackends={availableBackends}
            installExternalConnection={installExternalConnection}
            installExternalConnectionStatus={[
              ...installExternalConnectionStatuses,
            ]
              .reverse()
              .find(message => message.connection.id === config.id)}
            setSelectedId={setSelectedId}
          />
        ) : (
          <ConnectionEditorBox key={index}>
            <ConnectionTitle onClick={() => setSelectedId(config.id)}>
              <i className="codicon codicon-chevron-right" /> CONNECTION:{' '}
              {config.name || 'Untitled'}
            </ConnectionTitle>
          </ConnectionEditorBox>
        )
      )}
      {connections.length === 0 && (
        <EmptyStateBox>NO CONNECTIONS</EmptyStateBox>
      )}
      {dirty && (
        <ButtonGroup style={{margin: '10px'}}>
          <VSCodeButton
            onClick={() => {
              setDirty(false);
              saveConnections();
            }}
          >
            Save
          </VSCodeButton>
        </ButtonGroup>
      )}
    </div>
  );
};

const EmptyStateBox = styled.div`
  margin: 10px;
  background-color: var(--vscode-list-hoverBackground);
  padding: 10px;
  border: 1px solid var(--vscode-contrastBorder);
  color: var(--foreground);
  font-family: var(--font-family);
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
`;

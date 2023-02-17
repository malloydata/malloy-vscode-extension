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
  ExternalConnection,
  getDefaultIndex,
} from '../../../../common/connection_manager_types';
import {ConnectionMessageTest} from '../../../../common/message_types';
import {VSCodeButton} from '../../components';
import {ButtonGroup} from '../../components/ButtonGroup';
import {ConnectionEditor} from '../ConnectionEditor';

interface ConnectionEditorListProps {
  connections: ConnectionConfig[];
  setConnections: (connections: ConnectionConfig[]) => void;
  saveConnections: () => void;
  testConnection: (connection: ConnectionConfig) => void;
  testStatuses: ConnectionMessageTest[];
  requestServiceAccountKeyPath: (connectionId: string) => void;
  availableBackends: Array<ConnectionBackend | string>;
  externalConnections: Record<string, ExternalConnection>;
}

export const ConnectionEditorList: React.FC<ConnectionEditorListProps> = ({
  connections,
  setConnections,
  saveConnections,
  testConnection,
  testStatuses,
  requestServiceAccountKeyPath,
  availableBackends,
  externalConnections,
}) => {
  const [dirty, setDirty] = useState(false);
  const defaultConnectionIndex = getDefaultIndex(connections);

  const addConnection = () => {
    setConnections([
      ...connections,
      {
        name: '',
        backend: availableBackends[0],
        id: uuidv4(),
        isDefault: connections.length === 0,
      },
    ]);
  };

  const setConfig = (config: ConnectionConfig, index: number) => {
    const copy = [...connections];
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
    <EditorContainer>
      <ListContainer>
        {connections.map((config, index) => (
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
            externalConnections={externalConnections}
          />
        ))}
        {connections.length === 0 && (
          <EmptyStateBox>NO CONNECTIONS</EmptyStateBox>
        )}
      </ListContainer>
      <EditorButtons style={{margin: '10px'}}>
        <VSCodeButton onClick={addConnection}>New Connection</VSCodeButton>
        <Spacer />
        <VSCodeButton
          disabled={!dirty}
          onClick={() => {
            setDirty(false);
            saveConnections();
          }}
        >
          Save
        </VSCodeButton>
      </EditorButtons>
    </EditorContainer>
  );
};

const EditorContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const ListContainer = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: auto;
`;

const EditorButtons = styled(ButtonGroup)`
  flex: 0 0 auto;
`;

const Spacer = styled.div`
  flex: 1 1 auto;
`;

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

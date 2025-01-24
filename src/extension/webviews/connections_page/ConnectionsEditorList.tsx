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
import {v4 as uuidv4} from 'uuid';
import {VSCodeButton} from '@vscode/webview-ui-toolkit/react';
import {
  ConnectionBackend,
  ConnectionConfig,
} from '../../../common/types/connection_manager_types';
import {ConnectionMessageTest} from '../../../common/types/message_types';
import ChevronRightIcon from '../assets/chevron_right.svg';
import {ConnectionEditor} from './connection_editor/ConnectionEditor';
import styled from 'styled-components';

export interface ConnectionEditorProps {
  connections: ConnectionConfig[];
  setConnections: (connections: ConnectionConfig[], isNew?: boolean) => void;
  saveConnections: () => void;
  testConnection: (connection: ConnectionConfig) => void;
  testStatuses: ConnectionMessageTest[];
  requestFilePath: (
    connectionId: string,
    configKey: string,
    filters: {[key: string]: string[]}
  ) => void;
  availableBackends: ConnectionBackend[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

export const ConnectionEditorListRaw = ({
  connections,
  setConnections,
  saveConnections,
  testConnection,
  testStatuses,
  requestFilePath,
  availableBackends,
  selectedId,
  setSelectedId,
}: ConnectionEditorProps) => {
  const [dirty, setDirty] = useState(false);

  const addConnection = () => {
    const id = uuidv4();
    setConnections([
      ...connections,
      {
        name: '',
        backend: availableBackends[0],
        id,
      },
    ]);
    setSelectedId(id);
  };

  const setConfig = (config: ConnectionConfig, index: number) => {
    const copy = [...connections];
    copy[index] = config;
    setConnections(copy);
    setDirty(true);
  };

  return (
    <div style={{marginTop: '20px'}}>
      <div className="button-group" style={{margin: '10px'}}>
        <VSCodeButton onClick={addConnection}>New Connection</VSCodeButton>
      </div>
      {connections.map((config, index) =>
        selectedId === config.id ? (
          <ConnectionEditor
            key={index}
            config={config}
            setConfig={(newConfig: ConnectionConfig) =>
              setConfig(newConfig, index)
            }
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
            requestFilePath={requestFilePath}
            availableBackends={availableBackends}
            setSelectedId={setSelectedId}
          ></ConnectionEditor>
        ) : (
          <div key={index} className="connection-editor-box">
            <b
              className="connection-title"
              onClick={() => setSelectedId(config.id)}
            >
              <ChevronRightIcon width={16} height={16} />
              CONNECTION: {config.name || 'Untitled'}
            </b>
          </div>
        )
      )}
      {connections.length === 0 ? (
        <div className="empty-state-box">NO CONNECTIONS</div>
      ) : null}
      <div className="button-group" style={{margin: '10px'}}>
        <VSCodeButton
          onClick={() => {
            setDirty(false);
            saveConnections();
          }}
          disabled={!dirty}
        >
          Save
        </VSCodeButton>
      </div>
    </div>
  );
};

export const ConnectionEditorList = styled(ConnectionEditorListRaw)`
  .button-editor-group {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .empty-state-box {
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
  }
`;

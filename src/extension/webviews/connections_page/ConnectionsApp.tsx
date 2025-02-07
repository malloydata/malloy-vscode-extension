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
import {useCallback, useEffect, useState} from 'react';
import {VSCodeProgressRing} from '@vscode/webview-ui-toolkit/react';
import {
  ConnectionBackend,
  ConnectionConfig,
} from '../../../common/types/connection_manager_types';
import {
  ConnectionMessageType,
  ConnectionPanelMessage,
  ConnectionMessageTest,
  ConnectionTestStatus,
  ConnectionServiceFileRequestStatus,
} from '../../../common/types/message_types';
import {ConnectionEditorList} from './ConnectionsEditorList';
import {VsCodeApi} from '../vscode_wrapper';

export interface ConnectionsAppProp {
  vscode: VsCodeApi<ConnectionPanelMessage, void>;
}

export const ConnectionsApp = ({vscode}: ConnectionsAppProp) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionConfig[]>();
  const [testStatuses, setTestStatuses] = useState<ConnectionMessageTest[]>([]);
  const [availableBackends, setAvailableBackends] = useState<
    ConnectionBackend[]
  >([]);

  const postConnections = () => {
    vscode.postMessage({
      type: ConnectionMessageType.SetConnections,
      connections: connections || [],
      availableBackends,
    });
  };

  const testConnection = (connection: ConnectionConfig) => {
    const message: ConnectionMessageTest = {
      type: ConnectionMessageType.TestConnection,
      connection,
      status: ConnectionTestStatus.Waiting,
    };
    vscode.postMessage(message);
    setTestStatuses([...testStatuses, message]);
  };

  const requestFilePath = (
    connectionId: string,
    configKey: string,
    filters: {[key: string]: string[]}
  ) => {
    vscode.postMessage({
      type: ConnectionMessageType.RequestFile,
      connectionId,
      status: ConnectionServiceFileRequestStatus.Waiting,
      configKey,
      filters,
    });
  };

  const onMessage = useCallback(
    (event: MessageEvent<ConnectionPanelMessage>) => {
      const message = event.data;

      switch (message.type) {
        case ConnectionMessageType.EditConnection:
          setSelectedId(message.id);
          break;
        case ConnectionMessageType.SetConnections:
          setConnections(message.connections);
          setAvailableBackends(message.availableBackends);
          break;
        case ConnectionMessageType.TestConnection:
          setTestStatuses([...testStatuses, message]);
          break;
        case ConnectionMessageType.RequestFile: {
          if (message.status === ConnectionServiceFileRequestStatus.Success) {
            setConnections(
              (connections || []).map(connection => {
                const {connectionId, fsPath, configKey} = message;
                if (connection.id === connectionId) {
                  return {
                    ...connection,
                    [configKey]: fsPath,
                    configKey: message.configKey,
                  };
                } else {
                  return connection;
                }
              })
            );
          }
          break;
        }
      }
    },
    [connections, testStatuses]
  );

  useEffect(() => {
    window.addEventListener('message', onMessage);
    vscode.postMessage({type: ConnectionMessageType.AppReady});
    return () => window.removeEventListener('message', onMessage);
  }, [onMessage, vscode]);

  return connections === undefined ? (
    <div style={{height: '100%'}}>
      <VSCodeProgressRing>Loading</VSCodeProgressRing>
    </div>
  ) : (
    <div style={{maxWidth: '80em', height: '100%', overflowY: 'auto'}}>
      <div style={{margin: '0 10px 10px 10px'}}>
        <ConnectionEditorList
          connections={connections}
          setConnections={setConnections}
          saveConnections={postConnections}
          testConnection={testConnection}
          testStatuses={testStatuses}
          requestFilePath={requestFilePath}
          availableBackends={availableBackends}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
        ></ConnectionEditorList>
      </div>
    </div>
  );
};

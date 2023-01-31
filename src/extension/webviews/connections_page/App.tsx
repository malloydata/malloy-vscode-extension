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

import React, { useEffect, useState } from "react";
import {
  ConnectionBackend,
  ConnectionConfig,
} from "../../../common/connection_manager_types";
import {
  ConnectionMessageType,
  ConnectionPanelMessage,
  ConnectionMessageTest,
  ConnectionTestStatus,
  ConnectionServiceAccountKeyRequestStatus,
} from "../../message_types";
import { useConnectionsVSCodeContext } from "./connections_vscode_context";
import { ConnectionEditorList } from "./ConnectionEditorList";
import { Spinner } from "../components";
import styled from "styled-components";

export const App: React.FC = () => {
  const vscode = useConnectionsVSCodeContext();
  useEffect(() => {
    vscode.postMessage({ type: ConnectionMessageType.AppReady });
  });

  const [connections, setConnections] = useState<
    ConnectionConfig[] | undefined
  >();
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

  const requestServiceAccountKeyPath = (connectionId: string) => {
    vscode.postMessage({
      type: ConnectionMessageType.RequestBigQueryServiceAccountKeyFile,
      connectionId,
      status: ConnectionServiceAccountKeyRequestStatus.Waiting,
    });
  };

  useEffect(() => {
    const listener = (event: MessageEvent<ConnectionPanelMessage>) => {
      const message = event.data;

      switch (message.type) {
        case ConnectionMessageType.SetConnections:
          setConnections(message.connections);
          setAvailableBackends(message.availableBackends);
          break;
        case ConnectionMessageType.TestConnection:
          setTestStatuses([...testStatuses, message]);
          break;
        case ConnectionMessageType.RequestBigQueryServiceAccountKeyFile: {
          if (
            message.status === ConnectionServiceAccountKeyRequestStatus.Success
          ) {
            setConnections(
              (connections || []).map((connection) => {
                if (connection.id === message.connectionId) {
                  return {
                    ...connection,
                    serviceAccountKeyPath: message.serviceAccountKeyPath,
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
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  });

  return connections === undefined ? (
    <div style={{ height: "100%" }}>
      <Spinner text="Loading" />
    </div>
  ) : (
    <Scroll>
      <div style={{ margin: "0 10px 10px 10px" }}>
        <ConnectionEditorList
          connections={connections}
          setConnections={setConnections}
          saveConnections={postConnections}
          testConnection={testConnection}
          testStatuses={testStatuses}
          requestServiceAccountKeyPath={requestServiceAccountKeyPath}
          availableBackends={availableBackends}
        />
      </div>
    </Scroll>
  );
};

const Scroll = styled.div`
  height: 100%;
  overflow: auto;
`;

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as React from 'react';
import {useCallback, useEffect, useState} from 'react';
import {VSCodeProgressRing} from '@vscode/webview-ui-toolkit/react';
import {
  ConnectionPropertyInfo,
  ConnectionServiceFileRequestStatus,
  ConnectionTestStatus,
  SingleConnectionMessage,
  SingleConnectionMessageType,
} from '../../../common/types/message_types';
import {VsCodeApi} from '../vscode_wrapper';
import {GenericConnectionForm} from './GenericConnectionForm';

export interface ConnectionEditorAppProps {
  vscode: VsCodeApi<SingleConnectionMessage, void>;
}

interface ConnectionData {
  name: string;
  uuid: string;
  typeName: string;
  typeDisplayName: string;
  properties: ConnectionPropertyInfo[];
  values: Record<string, string | number | boolean>;
  existingNames: string[];
  registeredTypes: string[];
  isNew: boolean;
  readonly: boolean;
}

type TestStatus = 'idle' | 'waiting' | 'success' | 'error';

export const ConnectionEditorApp = ({vscode}: ConnectionEditorAppProps) => {
  const [data, setData] = useState<ConnectionData | null>(null);
  const [name, setName] = useState('');
  const [values, setValues] = useState<
    Record<string, string | number | boolean>
  >({});
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState('');

  const onMessage = useCallback(
    (event: MessageEvent<SingleConnectionMessage>) => {
      const message = event.data;
      switch (message.type) {
        case SingleConnectionMessageType.LoadConnection:
          setData({
            name: message.name,
            uuid: message.uuid,
            typeName: message.typeName,
            typeDisplayName: message.typeDisplayName,
            properties: message.properties,
            values: message.values,
            existingNames: message.existingNames,
            registeredTypes: message.registeredTypes,
            isNew: message.isNew,
            readonly: message.readonly ?? false,
          });
          setName(message.name);
          setValues({...message.values});
          setTestStatus('idle');
          setTestError('');
          break;
        case SingleConnectionMessageType.TestConnection:
          if (message.status === ConnectionTestStatus.Success) {
            setTestStatus('success');
          } else if (message.status === ConnectionTestStatus.Error) {
            setTestStatus('error');
            setTestError(message.error);
          }
          break;
        case SingleConnectionMessageType.RequestFile:
          if (message.status === ConnectionServiceFileRequestStatus.Success) {
            setValues(prev => ({
              ...prev,
              [message.propName]: message.fsPath,
            }));
          }
          break;
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener('message', onMessage);
    vscode.postMessage({type: SingleConnectionMessageType.AppReady});
    return () => window.removeEventListener('message', onMessage);
  }, [onMessage, vscode]);

  if (!data) {
    return (
      <div style={{height: '100%'}}>
        <VSCodeProgressRing>Loading</VSCodeProgressRing>
      </div>
    );
  }

  const handleSave = () => {
    vscode.postMessage({
      type: SingleConnectionMessageType.SaveConnection,
      originalName: data.isNew ? '' : data.name,
      name,
      values,
    });
    // Update internal state to reflect saved name
    setData({...data, name, isNew: false});
  };

  const handleDelete = () => {
    vscode.postMessage({
      type: SingleConnectionMessageType.DeleteConnection,
      name: data.isNew ? name : data.name,
    });
  };

  const handleCancel = () => {
    vscode.postMessage({
      type: SingleConnectionMessageType.CancelConnection,
    });
  };

  const handleTest = () => {
    setTestStatus('waiting');
    setTestError('');
    vscode.postMessage({
      type: SingleConnectionMessageType.TestConnection,
      status: ConnectionTestStatus.Waiting,
      name: name || 'test',
      values,
    });
  };

  const handleRequestFile = (
    propName: string,
    filters: Record<string, string[]>
  ) => {
    vscode.postMessage({
      type: SingleConnectionMessageType.RequestFile,
      status: ConnectionServiceFileRequestStatus.Waiting,
      propName,
      filters,
    });
  };

  const handleDuplicate = () => {
    vscode.postMessage({
      type: SingleConnectionMessageType.DuplicateConnection,
      name,
      values,
    });
  };

  const handleValueChange = (
    propName: string,
    value: string | number | boolean
  ) => {
    setValues(prev => ({...prev, [propName]: value}));
  };

  return (
    <div style={{maxWidth: '60em', height: '100%', overflowY: 'auto'}}>
      <div style={{margin: '10px 10px 10px 10px'}}>
        <GenericConnectionForm
          name={name}
          setName={setName}
          typeName={data.typeName}
          typeDisplayName={data.typeDisplayName}
          properties={data.properties}
          values={values}
          onValueChange={handleValueChange}
          existingNames={data.existingNames}
          registeredTypes={data.registeredTypes}
          isNew={data.isNew}
          readonly={data.readonly}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={handleCancel}
          onDuplicate={handleDuplicate}
          onTest={handleTest}
          onRequestFile={handleRequestFile}
          testStatus={testStatus}
          testError={testError}
        />
      </div>
    </div>
  );
};

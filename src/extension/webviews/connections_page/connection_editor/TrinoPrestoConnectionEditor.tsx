import * as React from 'react';
import {VSCodeTextField} from '@vscode/webview-ui-toolkit/react';
import {
  PrestoConnectionConfig,
  TrinoConnectionConfig,
} from '../../../../common/types/connection_manager_types';
import {ConnectionEditorTable} from './ConnectionEditorTable';
import {SecretEditor} from './components/SecretEditor';
export interface TrinoPrestoConnectionEditorProps {
  config: PrestoConnectionConfig | TrinoConnectionConfig;
  setConfig: (config: PrestoConnectionConfig | TrinoConnectionConfig) => void;
}
export const TrinoPrestoConnectionEditor = ({
  config,
  setConfig,
}: TrinoPrestoConnectionEditorProps) => {
  return (
    <ConnectionEditorTable>
      <tbody>
        <tr>
          <td className="label-cell">
            <label>Name:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.name}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, name: value});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Host:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.server || ''}
              placeholder="http(s)://..."
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, server: value});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Port:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.port ? config.port.toString() : ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, port: parseInt(value)});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Catalog:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.catalog || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, catalog: value});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Schema:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.schema || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, schema: value});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>User:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.user || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, user: value});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Password:</label>
          </td>
          <td>
            <SecretEditor
              secret={config.password}
              setSecret={(secret: string) => {
                setConfig({...config, password: secret});
              }}
            />
          </td>
        </tr>
      </tbody>
    </ConnectionEditorTable>
  );
};

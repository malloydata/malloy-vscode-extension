import {VSCodeTextField} from '@vscode/webview-ui-toolkit/react';
import {MysqlConnectionConfig} from '../../../../common/types/connection_manager_types';
import {SecretEditor} from './components/SecretEditor';
import {ConnectionEditorTable} from './ConnectionEditorTable';

export interface MysqlConnectionEditorProps {
  config: MysqlConnectionConfig;
  setConfig: (config: MysqlConnectionConfig) => void;
}

export const MysqlConnectionEditor = ({
  config,
  setConfig,
}: MysqlConnectionEditorProps) => {
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
              value={config.host || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, host: value});
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
            <label>Database:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.database || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, database: value});
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
            ></SecretEditor>
          </td>
        </tr>
      </tbody>
    </ConnectionEditorTable>
  );
};

/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {VSCodeTextField} from '@vscode/webview-ui-toolkit/react';
import {PublisherConnectionConfig} from '../../../../common/types/connection_manager_types';
import {ConnectionEditorTable} from './ConnectionEditorTable';

export interface PublisherConnectionEditorProps {
  config: PublisherConnectionConfig;
  setConfig: (config: PublisherConnectionConfig) => void;
}

export const PublisherConnectionEditor = ({
  config,
  setConfig,
}: PublisherConnectionEditorProps) => {
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
            <label>Connection URI:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.connectionUri || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, connectionUri: value});
              }}
            ></VSCodeTextField>
          </td>
        </tr>
        <tr>
          <td className="label-cell">
            <label>Access Token:</label>
          </td>
          <td>
            <VSCodeTextField
              value={config.accessToken || ''}
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setConfig({...config, accessToken: value});
              }}
              placeholder="Optional"
            ></VSCodeTextField>
          </td>
        </tr>
      </tbody>
    </ConnectionEditorTable>
  );
};

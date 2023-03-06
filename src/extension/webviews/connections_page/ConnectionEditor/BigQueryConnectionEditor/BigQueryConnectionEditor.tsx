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

import React from 'react';
import {BigQueryConnectionConfig} from '../../../../../common/connection_manager_types';
import {TextField, VSCodeButton} from '../../../components';
import {Label} from '../Label';
import {LabelCell} from '../LabelCell';

interface BigQueryConnectionEditorProps {
  config: BigQueryConnectionConfig;
  setConfig: (config: BigQueryConnectionConfig) => void;
  requestServiceAccountKeyPath: () => void;
}

export const BigQueryConnectionEditor: React.FC<
  BigQueryConnectionEditorProps
> = ({config, setConfig, requestServiceAccountKeyPath}) => {
  return (
    <table>
      <tbody>
        <tr>
          <LabelCell>
            <Label>Name:</Label>
          </LabelCell>
          <td>
            <TextField
              value={config.name}
              setValue={name => {
                setConfig({...config, name});
              }}
            />
          </td>
        </tr>
        <tr>
          <LabelCell>
            <Label>Project Name:</Label>
          </LabelCell>
          <td>
            <TextField
              value={config.projectName || ''}
              setValue={projectName => {
                setConfig({...config, projectName});
              }}
              placeholder="Optional"
            />
          </td>
        </tr>
        <tr>
          <LabelCell>
            <Label>Location:</Label>
          </LabelCell>
          <td>
            <TextField
              value={config.location || ''}
              setValue={location => {
                setConfig({...config, location});
              }}
              placeholder="Optional (default US)"
            />
          </td>
        </tr>
        <tr>
          <LabelCell>
            <Label>Service Account Key File Path:</Label>
          </LabelCell>
          <td>
            <TextField
              value={config.serviceAccountKeyPath || ''}
              setValue={serviceAccountKeyPath => {
                setConfig({...config, serviceAccountKeyPath});
              }}
              placeholder="Optional"
            />
          </td>
          <td>
            <VSCodeButton
              onClick={requestServiceAccountKeyPath}
              style={{height: '25px'}}
            >
              Pick File
            </VSCodeButton>
          </td>
        </tr>
        <tr>
          <LabelCell>
            <Label>Maximum Bytes Billed:</Label>
          </LabelCell>
          <td>
            <TextField
              value={config.maximumBytesBilled || ''}
              setValue={maximumBytesBilled => {
                setConfig({...config, maximumBytesBilled});
              }}
              placeholder="Optional"
            />
          </td>
        </tr>
        <tr>
          <LabelCell>
            <Label>Query Timeout Milliseconds:</Label>
          </LabelCell>
          <td>
            <TextField
              value={config.timeoutMs || ''}
              setValue={timeoutMs => {
                setConfig({...config, timeoutMs});
              }}
              placeholder="Optional"
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
};

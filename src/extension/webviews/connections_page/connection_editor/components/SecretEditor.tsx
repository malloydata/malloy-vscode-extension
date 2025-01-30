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
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import styled from 'styled-components';

export interface SecretEditorProps {
  secret?: string;
  setSecret: (secret: string) => void;
}

export const SecretEditor = ({secret, setSecret}: SecretEditorProps) => {
  const [showSecret, setShowSecret] = useState(false);
  const [settingSecret, setSettingSecret] = useState(false);
  const [currentSecret, setCurrentSecret] = useState('');

  return (
    <Column>
      {settingSecret ? (
        <>
          <div className="button-group">
            <VSCodeTextField
              onChange={({target}) => {
                const value = (target as HTMLInputElement).value;
                setCurrentSecret(value);
              }}
              type={showSecret ? 'text' : 'password'}
            ></VSCodeTextField>
          </div>
          <div className="button-group">
            <VSCodeButton
              onClick={() => {
                setSettingSecret(false);
                setSecret(currentSecret);
              }}
            >
              {secret ? 'Change' : 'Set'}
            </VSCodeButton>
            <VSCodeButton
              onClick={() => {
                setSettingSecret(false);
              }}
            >
              Cancel
            </VSCodeButton>
            <VSCodeCheckbox
              checked={showSecret}
              onChange={({target}) => {
                const checked = (target as HTMLInputElement).checked;
                setShowSecret(checked);
              }}
            >
              Show Secret
            </VSCodeCheckbox>
          </div>
        </>
      ) : (
        <div className="button-group">
          <VSCodeButton
            onClick={() => {
              setSettingSecret(true);
            }}
          >
            {secret ? 'Change' : 'Set'}
          </VSCodeButton>
          {secret ? (
            <VSCodeButton
              onClick={() => {
                setSecret('');
              }}
            >
              Clear
            </VSCodeButton>
          ) : null}
        </div>
      )}
    </Column>
  );
};

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

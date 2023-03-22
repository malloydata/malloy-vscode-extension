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

import React, {useEffect, useState} from 'react';
import styled from 'styled-components';
import Markdown from 'markdown-to-jsx';

import {HelpMessageType} from '../../../common/message_types';
import {VSCodeButton} from '@vscode/webview-ui-toolkit/react';
import {useHelpVSCodeContext} from './help_vscode_context';
import {COMPLETION_DOCS} from '../../../common/completion_docs';

export const App: React.FC = () => {
  const [help, setHelp] = useState('');
  const vscode = useHelpVSCodeContext();

  // TODO crs this might only be necessary because the MessageManager makes it necessary
  useEffect(() => {
    vscode.postMessage({type: HelpMessageType.AppReady});
  });

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const {keyword} = event.data;
      const [_, malloy_keyword] = keyword.split('.');
      let hint_text = '';
      if (COMPLETION_DOCS['model_property'][malloy_keyword]) {
        hint_text = COMPLETION_DOCS['model_property'][malloy_keyword];
      } else if (COMPLETION_DOCS['query_property'][malloy_keyword]) {
        hint_text = COMPLETION_DOCS['query_property'][malloy_keyword];
      } else if (COMPLETION_DOCS['explore_property'][malloy_keyword]) {
        hint_text = COMPLETION_DOCS['explore_property'][malloy_keyword];
      }
      setHelp(hint_text);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  });

  return (
    <ViewDiv>
      <ButtonLink href="https://malloydata.github.io/documentation/">
        View Documentation
      </ButtonLink>
      <ButtonLink href="https://malloydata.github.io/documentation/user_guides/basic.html">
        Quick Start Guide
      </ButtonLink>
      <ButtonLink href="https://github.com/malloydata/malloy-samples/releases">
        Download Sample Models
      </ButtonLink>
      <Help>
        <h3>Quick Help</h3>
        {help && <Markdown>{help}</Markdown>}
        {!help && <span>Select a keyword for quick help.</span>}
      </Help>
    </ViewDiv>
  );
};

const ButtonLink: React.FC<{href: string; small?: boolean}> = ({
  href,
  children,
  small = false,
}) => {
  return (
    <a
      href={href}
      style={{
        textDecoration: 'none',
        width: small ? '100px' : '100%',
        maxWidth: '300px',
      }}
    >
      <VSCodeButton style={{height: '26px', width: '100%', maxWidth: '300px'}}>
        {children}
      </VSCodeButton>
    </a>
  );
};

const ViewDiv = styled.div`
  padding: 1em 20px 1em;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
`;

const Help = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

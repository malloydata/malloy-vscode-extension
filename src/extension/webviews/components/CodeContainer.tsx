/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as React from 'react';
import {useEffect, useState} from 'react';
import styled from 'styled-components';

import {
  highlightPre,
  SupportedLang,
} from './syntax_highlighting/syntaxHighlighter';

export interface CodeContainerProps {
  darkMode: boolean;
  code: string;
  language: SupportedLang;
}

export function CodeContainer({code, darkMode, language}: CodeContainerProps) {
  const [html, setHtml] = useState<TrustedHTML>();

  useEffect(() => {
    const doHighlight = async () => {
      const html = await highlightPre(
        code,
        language,
        darkMode ? 'dark-plus' : 'light-plus',
        {
          showLineNumbers: true,
          lineSpacing: 'oneAndAHalf',
        }
      );
      setHtml(html);
    };
    void doHighlight();
  }, [code, darkMode, language]);

  if (html) {
    return <StyledCode dangerouslySetInnerHTML={{__html: html}} />;
  } else {
    return null;
  }
}

const StyledCode = styled.div`
  font-family: var(--vscode-editor-font-family);
  font-size: var(--vscode-editor-font-size);
  margin: 10px;
  line-height: 1.5em;
`;

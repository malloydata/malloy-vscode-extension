/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import * as prism from 'prismjs';
import {HtmlSanitizerBuilder} from 'safevalues';

import 'prismjs/components/prism-json';
import 'prismjs/components/prism-sql';
import styled from 'styled-components';

export interface CodeContainerProps {
  darkMode: boolean;
  code: string;
  language?: string;
}

export function CodeContainer({code, darkMode, language}: CodeContainerProps) {
  if (!language) {
    throw new Error('language is required to render code');
  }
  const sanitizer = new HtmlSanitizerBuilder().allowClassAttributes().build();
  const sanitizedCode = sanitizer.sanitize(
    prism.highlight(code, prism.languages[language], language)
  );

  return (
    <StyledCode className={darkMode ? 'dark' : 'light'}>
      <pre dangerouslySetInnerHTML={{__html: sanitizedCode}} />
    </StyledCode>
  );
}

const StyledCode = styled.div`
  pre {
    font-family: var(--vscode-editor-font-family);
    font-size: var(--vscode-editor-font-size);
    margin: 10px;
    white-space: pre-wrap;
  }

  &.dark > pre {
    color: #9cdcfe; //#333388;
  }
  &.dark .keyword {
    color: #c586c0; //#af00db;
  }

  &.dark .comment {
    color: #6a9955; //#4f984f;
  }

  &.dark .function,
  &.dark .function_keyword {
    color: #ce9178; //#795e26;
  }

  &.dark .string {
    color: #d16969; //#ca4c4c;
  }

  &.dark .regular_ex {
    color: #f03e91; //#88194d;
  }

  &.dark .operator,
  &.dark .punctuation {
    color: #dadada; //#505050;
  }

  &.dark .punctuation {
    color: #dadada; //#505050;
  }

  &.dark .number {
    color: #4ec9b0; //#09866a;
  }

  &.dark .type,
  &.dark .timeframe {
    color: #569cd6; //#0070c1;
  }

  &.dark .date {
    color: #4ec9b0; //#09866a;
    /* color: #8730b3;//#8730b3;; */
  }

  &.dark .property {
    color: #dcdcaa; //#b98f13;
  }

  &.light > pre {
    color: #333388;
  }
  &.light .keyword {
    color: #af00db;
  }

  &.light .comment {
    color: #4f984f;
  }

  &.light .function,
  &.light .function_keyword {
    color: #795e26;
  }

  &.light .string {
    color: #ca4c4c;
  }

  &.light .regular_ex {
    color: #88194d;
  }

  &.light .operator,
  &.light .punctuation {
    color: #505050;
  }

  &.light .punctuation {
    color: #505050;
  }

  &.light .number {
    color: #09866a;
  }

  &.light .type,
  &.light .timeframe {
    color: #0070c1;
  }

  &.light .date {
    color: #09866a;
    /* color: #8730b3;//#8730b3;; */
  }

  &.light .property {
    color: #b98f13;
  }
`;

/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import styled from 'styled-components';

export interface ErrorPanelProps {
  message?: string;
}

export function ErrorPanel({message}: ErrorPanelProps) {
  if (!message) {
    return null;
  }

  const parts = message.split(/((?:http|https|vscode):\/\/\S*)\b/);
  const multiLine = parts.length > 1;
  const formatted = parts.map((part, idx) => {
    if (part.match(/^(http|https|vscode):/)) {
      return (
        <a key={idx} href={part}>
          {part}
        </a>
      );
    } else {
      return part;
    }
  });
  return <ErrorPanelInner $multiLine={multiLine}>{formatted}</ErrorPanelInner>;
}

interface ErrorPanelInnerProps {
  $multiLine: boolean;
}

const ErrorPanelInner = styled.div<ErrorPanelInnerProps>`
  white-space: ${({$multiLine}) => ($multiLine ? 'pre-wrap' : 'normal')};
  font-family: ${({$multiLine}) => ($multiLine ? 'monospace' : 'inherit')};
  word-wrap: ${({$multiLine}) => ($multiLine ? 'break-word' : 'initial')};
  background-color: var(--vscode-inputValidation-errorBackground);
  padding: 10px;
  margin: 30px;
  border-radius: 4px;
  font-size: var(--vscode-editor-font-size);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  overflow: auto;
`;

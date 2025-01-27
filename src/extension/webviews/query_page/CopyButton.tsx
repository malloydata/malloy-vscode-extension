/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import Copy from '../assets/copy.svg';
import '../components/PopupDialog';
import './DownloadForm';
import styled from 'styled-components';

export interface CopyButtonProps {
  onCopy: () => void;
  className?: string;
}

export function CopyButton({onCopy, className}: CopyButtonProps) {
  return (
    <StyledButton className={className} onClick={onCopy}>
      <Copy />
    </StyledButton>
  );
}

const StyledButton = styled.div`
  width: 25px;
  height: 25px;
  background-color: var(--vscode-editorWidget-background);
  color: var(--vscode-editorWidget-foreground);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 4px;
  cursor: pointer;

  svg {
    width: 25px;
    height: 25px;
  }
`;

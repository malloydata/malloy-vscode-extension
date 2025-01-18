/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import styled from 'styled-components';

export interface PopupDialogProps {
  open: boolean;
  children: React.ReactNode;
}

export function PopupDialog({open, children}: PopupDialogProps) {
  return (
    <Popover className={open ? 'open' : ''}>
      <PopoverContent>{children}</PopoverContent>
    </Popover>
  );
}

const Popover = styled.div`
  position: absolute;
  display: none;
  right: 10px;
  border: 1px solid var(--dropdown-border);
  box-shadow: rgba(0, 0, 0, 0.1) 0px 1px 5px 1px;
  background-color: var(--dropdown-background);
  color: var(--dropdown-foreground);
  font-size: var(--vscode-font-size);
  width: 200px;
  padding: 15px;
  flex-direction: column;

  &.open {
    display: flex;
    z-index: 1001;
  }
`;

const PopoverContent = styled.div`
  display: flex;
  flex-direction: column;
`;

/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import styled from 'styled-components';

export enum ResultKind {
  HTML = 'html',
  JSON = 'json',
  METADATA = 'metadata',
  PREVIEW = 'preview',
  SQL = 'sql',
  SCHEMA = 'schema',
}

export const resultKindFromString = (kind?: string) => {
  switch (kind) {
    case 'html':
      return ResultKind.HTML;
    case 'json':
      return ResultKind.JSON;
    case 'metadata':
      return ResultKind.METADATA;
    case 'preview':
      return ResultKind.PREVIEW;
    case 'sql':
      return ResultKind.SQL;
    case 'schema':
      return ResultKind.SCHEMA;
  }

  return undefined;
};

export interface ResultKindToggleProps {
  availableKinds: ResultKind[];
  resultKind: ResultKind;
  setKind: (kind: ResultKind) => void;
}

export function ResultKindToggle({
  availableKinds,
  resultKind,
  setKind,
}: ResultKindToggleProps) {
  return (
    <StyledToggle>
      {availableKinds.map(kind => (
        <ResultControl
          key={kind}
          selected={resultKind === kind}
          onClick={() => setKind(kind)}
        >
          {kind}
        </ResultControl>
      ))}
    </StyledToggle>
  );
}

const StyledToggle = styled.div`
  display: flex;
  justify-content: end;
  padding: 5px 5px 3px 5px;
  font-size: 12px;
  gap: 3px;
  text-transform: uppercase;
`;

export interface ResultControlProps {
  selected: boolean;
  label: string;
}

const ResultControl = styled.div<{selected: boolean}>`
  border: 0;
  border-bottom: none;
  cursor: pointer;
  padding: 3px 5px;
  color: var(--vscode-panelTitle-activeForeground);
  border-bottom: ${({selected}) =>
    selected ? '1px solid var(--vscode-panelTitle-activeBorder)' : 'none'};
`;

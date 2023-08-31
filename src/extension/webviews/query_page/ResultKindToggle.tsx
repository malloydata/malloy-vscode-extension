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
import styled from 'styled-components';

export enum ResultKind {
  HTML = 'html',
  JSON = 'json',
  SQL = 'sql',
  SCHEMA = 'schema',
}

interface ResultKindToggleProps {
  kind: ResultKind;
  setKind: (kind: ResultKind) => void;
  showOnlySQL: boolean;
}

export const ResultKindToggle: React.FC<ResultKindToggleProps> = ({
  kind,
  setKind,
  showOnlySQL,
}) => {
  return (
    <div>
      <ResultControls>
        {!showOnlySQL && (
          <ResultControl
            selected={kind === ResultKind.HTML}
            onClick={() => setKind(ResultKind.HTML)}
          >
            HTML
          </ResultControl>
        )}
        {!showOnlySQL && (
          <ResultControl
            selected={kind === ResultKind.JSON}
            onClick={() => setKind(ResultKind.JSON)}
          >
            JSON
          </ResultControl>
        )}
        <ResultControl
          selected={kind === ResultKind.SCHEMA}
          onClick={() => setKind(ResultKind.SCHEMA)}
        >
          SCHEMA
        </ResultControl>
        <ResultControl
          selected={kind === ResultKind.SQL}
          onClick={() => setKind(ResultKind.SQL)}
        >
          SQL
        </ResultControl>
      </ResultControls>
    </div>
  );
};

const ResultControls = styled.div`
  display: flex;
  justify-content: end;
  padding: 5px 5px 0 5px;
  font-size: 12px;
  gap: 3px;
`;

interface ResultControlProps {
  selected: boolean;
}

const ResultControl = styled.button<ResultControlProps>`
  border: 0;
  border-bottom: 1px solid ${props => (props.selected ? '#4285f4' : 'white')};
  cursor: pointer;
  background-color: white;
  padding: 3px 5px;
  color: ${props => (props.selected ? '#4285f4' : '#b1b1b1')};

  &:hover {
    border-bottom: 1px solid;
    color: #4285f4;
  }
`;

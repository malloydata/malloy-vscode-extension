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
  SQL = 'sql',
}

interface ResultKindToggleProps {
  kind: ResultKind;
  setKind: (kind: ResultKind) => void;
}

export const ResultKindToggle: React.FC<ResultKindToggleProps> = ({
  kind,
  setKind,
}) => {
  return (
    <div>
      <ResultControls>
        <ResultControl
          data-selected={kind === ResultKind.HTML}
          onClick={() => setKind(ResultKind.HTML)}
        >
          HTML
        </ResultControl>
        <ResultControl
          data-selected={kind === ResultKind.SQL}
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

const ResultControl = styled.button`
  border: 0;
  border-bottom: 1px solid white;
  cursor: pointer;
  background-color: white;
  padding: 3px 5px;
  color: #b1b1b1;

  &:hover,
  &[data-selected='true'] {
    border-bottom: 1px solid #4285f4;
    color: #4285f4;
  }
`;

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
import styled from 'styled-components';

const SimpleErrorMessage = styled.div`
  padding: 5px;
  background-color: #fbb;
  font-family: Arial, Helvetica, sans-serif, sans-serif;
  font-size: 12px;
  color: #4b4c50;
  border-radius: 5px;
`;

const MultiLineErrorMessage = styled(SimpleErrorMessage)`
  white-space: pre-wrap;
  font-family: Courier, Menlo, monspace, monospace;
`;

export interface ErrorMessageProps {
  error: string | null | undefined;
}

export const ErrorMessage = ({
  error,
}: ErrorMessageProps): React.ReactElement | null => {
  if (error) {
    if (error.split('\n').length > 1) {
      return <MultiLineErrorMessage>{error}</MultiLineErrorMessage>;
    } else {
      return <SimpleErrorMessage>{error}</SimpleErrorMessage>;
    }
  }
  return null;
};

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

import styled from 'styled-components';

import 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-sql';

interface PrismContainerProps {
  darkMode: boolean;
}

export const PrismContainer = styled.pre<PrismContainerProps>`
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
  color: ${props => (props.darkMode ? '#9cdcfe' : '#333388')};

  span.token.keyword {
    color: ${props => (props.darkMode ? '#c586c0' : '#af00db')};
  }

  span.token.comment {
    color: ${props => (props.darkMode ? '#6a9955' : '#4f984f')};
  }

  span.token.function,
  span.token.function_keyword {
    color: ${props => (props.darkMode ? '#ce9178' : '#795e26')};
  }

  span.token.string {
    color: ${props => (props.darkMode ? '#d16969' : '#ca4c4c')};
  }

  span.token.regular_expression {
    color: ${props => (props.darkMode ? '#f03e91' : '#88194d')};
  }

  span.token.operator,
  span.token.punctuation {
    color: ${props => (props.darkMode ? '#dadada' : '#505050')};
  }

  span.token.number {
    color: ${props => (props.darkMode ? '#4ec9b0' : '#09866a')};
  }

  span.token.type,
  span.token.timeframe {
    color: ${props => (props.darkMode ? '#569cd6 ' : '#0070c1')};
  }

  span.token.date {
    color: ${props => (props.darkMode ? '#4ec9b0' : '#09866a')};
    /* color: ${props => (props.darkMode ? '#8730b3' : '#8730b3')};; */
  }

  span.token.property {
    color: ${props => (props.darkMode ? '#dcdcaa' : '#b98f13')};
  }
`;

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
import Prism from 'prismjs';
import {Result, ResultJSON} from '@malloydata/malloy';
import {PrismContainer} from '../../webviews/components/PrismContainer';

export interface ResultProps {
  results: ResultJSON;
}

export const JsonRenderer: React.FC<ResultProps> = ({results}) => {
  const [json, setJson] = React.useState<string>();

  React.useEffect(() => {
    if (results) {
      const {data} = Result.fromJSON(results);
      setJson(JSON.stringify(data.toObject(), null, 2));
    }
  }, [results]);

  if (json) {
    return (
      <PrismContainer darkMode={false} style={{margin: '10px'}}>
        <div
          dangerouslySetInnerHTML={{
            __html: Prism.highlight(json, Prism.languages['json'], 'json'),
          }}
          style={{margin: '10px'}}
        />
      </PrismContainer>
    );
  }
  return null;
};

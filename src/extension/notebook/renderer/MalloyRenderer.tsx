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
import {Result, ResultJSON} from '@malloydata/malloy';
import {HTMLView} from '@malloydata/render';

export interface ResultProps {
  results: ResultJSON;
}

export const MalloyRenderer: React.FC<ResultProps> = ({results}) => {
  const [html, setHtml] = React.useState<HTMLElement>();

  React.useEffect(() => {
    if (results) {
      const data = Result.fromJSON(results).data;
      console.info('data', data);

      const rendering = new HTMLView(document).render(data, {dataStyles: {}});
      rendering.then(rendered => {
        setHtml(rendered);
      });
    }
  }, [results]);

  if (html) {
    return <DOMElement element={html} />;
  }
  return null;
};

const DOMElement: React.FC<{element: HTMLElement}> = ({element}) => {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const parent = ref.current;
    if (parent) {
      parent.innerHTML = '';
      parent.appendChild(element);
    }
  }, [element]);

  return <div ref={ref}></div>;
};

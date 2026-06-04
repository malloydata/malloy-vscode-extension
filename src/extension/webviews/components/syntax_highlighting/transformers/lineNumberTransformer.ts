/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Element} from 'hast';
import {GetTransformer} from './types';

const getLineNumberTransformer: GetTransformer = ({
  showLineNumbers,
}: {
  showLineNumbers: boolean;
}) => {
  if (!showLineNumbers) {
    return undefined;
  }

  return {
    line(node: Element, line: number) {
      const span: Element = {
        type: 'element',
        tagName: 'span',
        children: [{type: 'text', value: `${line}`}],
        properties: {
          style: [
            'color: rgba(115, 138, 148, 0.4);',
            'margin-right: 35px;',
            'width: 1px;',
            'display: inline-block;',
            'user-select: none',
          ],
        },
      };

      node.children.unshift(span);
    },
  };
};

export default getLineNumberTransformer;

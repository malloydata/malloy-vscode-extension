/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Element} from 'hast';
import {GetTransformer, TransformerOptions} from './transformers';

const LINE_SPACING_MAP = {
  single: '1em',
  oneAndAHalf: '1.5em',
  double: '2em',
};

export type LineSpacing = keyof typeof LINE_SPACING_MAP;

const getLineSpacingTransformer: GetTransformer = ({
  lineSpacing,
}: TransformerOptions) => {
  return {
    line(node: Element) {
      const styled = [
        ...(Array.isArray(node.properties['style'])
          ? node.properties['style']
          : typeof node.properties['style'] === 'string'
          ? [node.properties['style']]
          : []),
      ];

      styled.push(`line-height: ${LINE_SPACING_MAP[lineSpacing]};`);
      node.properties['style'] = styled;
    },
  };
};

export default getLineSpacingTransformer;

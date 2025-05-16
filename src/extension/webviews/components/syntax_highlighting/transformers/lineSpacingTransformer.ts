/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Element} from 'hast';
import type {GetTransformer, LineSpacing} from './types';

export const LINE_SPACING_MAP: Record<LineSpacing, string> = {
  single: '1em',
  oneAndAHalf: '1.5em',
  double: '2em',
};

const getLineSpacingTransformer: GetTransformer = ({
  lineSpacing,
}: {
  lineSpacing: LineSpacing;
}) => {
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

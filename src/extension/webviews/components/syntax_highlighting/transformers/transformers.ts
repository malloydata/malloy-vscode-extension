/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ShikiTransformer} from '@shikijs/types';
import lineSpacingTransformer from './lineSpacingTransformer';
import lineNumberTransformer from './lineNumberTransformer';
import {GetTransformer, TransformerOptions} from './types';

const transformers: Array<GetTransformer> = [
  lineSpacingTransformer,
  lineNumberTransformer,
];

export default function getTransformers(
  options: TransformerOptions
): Array<ShikiTransformer> {
  return transformers.map(t => t(options)).filter(t => t !== undefined);
}

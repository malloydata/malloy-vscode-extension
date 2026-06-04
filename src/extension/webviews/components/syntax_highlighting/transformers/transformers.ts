/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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

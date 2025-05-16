/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ShikiTransformer} from '@shikijs/types';

export type LineSpacing = 'single' | 'oneAndAHalf' | 'double';

export type TransformerOptions = {
  showLineNumbers: boolean;
  lineSpacing: LineSpacing;
};

export type GetTransformer = (
  options: TransformerOptions
) => ShikiTransformer | undefined;

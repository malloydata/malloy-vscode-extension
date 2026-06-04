/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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

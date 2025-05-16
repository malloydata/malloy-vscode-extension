/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  createHighlighterCore,
  HighlighterCore,
  LanguageRegistration,
} from '@shikijs/core';
import lightPlus from '@shikijs/themes/light-plus';
import darkPlus from '@shikijs/themes/dark-plus';
import sql from '@shikijs/langs/sql';
import json from '@shikijs/langs/json';
import {HtmlSanitizerBuilder} from 'safevalues';

import MALLOY_GRAMMAR from '@malloydata/syntax-highlight/grammars/malloy/malloy.tmGrammar.json';
import getTransformers, {TransformerOptions} from './transformers/transformers';

/**
 * JS engine is smaller and recommended for browser.
 * Textmate grammar regexp are written for the Oniguruma engine written in C
 * Oniguruma regexp is transpiled to js's RegExp here, but may not have full compatibility
 * if encounter issues, switch to the Oniguruma engine and import the wasm binary
 * from shiki
 */
import {createJavaScriptRegexEngine} from '@shikijs/engine-javascript';

export type SupportedLang = 'json' | 'sql' | 'malloy';
export type SupportedTheme = 'light-plus' | 'dark-plus';

type HighlighterOptions = TransformerOptions;

let highlighter: Promise<HighlighterCore>;
function getHighlighter() {
  if (highlighter) {
    return highlighter;
  }

  highlighter = createHighlighterCore({
    themes: [lightPlus, darkPlus],
    langs: [
      sql,
      json,
      {
        name: 'malloy',
        embeddedLangs: ['sql'],
        ...MALLOY_GRAMMAR,
      } as LanguageRegistration,
    ],
    engine: createJavaScriptRegexEngine(),
  });

  return highlighter;
}

export async function highlightPre(
  code: string,
  lang: SupportedLang,
  theme: SupportedTheme,
  {showLineNumbers, lineSpacing}: HighlighterOptions
): Promise<TrustedHTML> {
  const highlighter = await getHighlighter();
  const highlighted = highlighter.codeToHtml(code, {
    lang: lang,
    theme: theme,
    transformers: getTransformers({
      showLineNumbers: showLineNumbers,
      lineSpacing: lineSpacing,
    }),
  });
  const sanitizer = new HtmlSanitizerBuilder()
    .allowClassAttributes()
    .allowStyleAttributes()
    .build();
  return sanitizer.sanitize(highlighted);
}

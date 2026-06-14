/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// The malloy grammar ships as a JSON TextMate grammar. With `resolveJsonModule`
// TypeScript would infer the file's exact literal type, which does not satisfy
// shiki's `RawGrammar` index signatures (sibling patterns use different numbered
// capture keys, producing `{ "2"?: undefined }`-style members). Declaring the
// import at its true, widened grammar type lets us register it without a cast.
declare module '@malloydata/syntax-highlight/grammars/malloy/malloy.tmGrammar.json' {
  import type {RawGrammar} from '@shikijs/core';
  const grammar: RawGrammar;
  export default grammar;
}

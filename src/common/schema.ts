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

import {
  Explore,
  Field,
  JoinRelationship,
  ModelDef,
  isSourceDef,
} from '@malloydata/malloy';

export function isFieldAggregate(field: Field) {
  return field.isAtomicField() && field.isCalculation();
}

export function fieldType(field: Field) {
  return field.isAtomicField() ? field.type.toString() : 'query';
}

export function exploreSubtype(explore: Explore) {
  let subtype;
  if (explore.hasParentExplore()) {
    const relationship = explore.joinRelationship;
    subtype =
      relationship === JoinRelationship.ManyToOne
        ? 'many_to_one'
        : relationship === JoinRelationship.OneToMany
        ? 'one_to_many'
        : JoinRelationship.OneToOne
        ? 'one_to_one'
        : 'base';
  } else {
    subtype = 'base';
  }
  return subtype;
}

/**
 * Cache of compiled field hiding patterns so that for a given schema
 * view render, the pattern only needs to be compiled once. Uses a WeakMap
 * because the Explore object is typically re-created for each render.
 */
const hiddenFields = new WeakMap<
  Explore,
  {strings: string[]; pattern?: RegExp}
>();

/**
 * Guard created because TypeScript wasn't simply treating
 * `typeof tag === 'string` as a sufficient guard in filter()
 *
 * @param tag string | undefined
 * @returns true if tag is a string
 */
const isStringTag = (tag: string | undefined): tag is string =>
  typeof tag === 'string';

/**
 * Determine whether to hide a field in the schema viewer based on tags
 * applied to the source.
 *
 * `hidden = ["field1", "field2"]` will hide individual fields
 * `hidden.pattern = "^_"` will hide fields that match the regular expression
 * /^_/. They can be combined.
 *
 * @param field A Field object
 * @returns true if field should not be displayed in schema viewer
 */
export function isFieldHidden(field: Field): boolean {
  const {name, parentExplore} = field;
  let hidden = hiddenFields.get(parentExplore);
  if (!hidden) {
    const {tag} = parentExplore.tagParse();
    const strings =
      tag
        .array('hidden')
        ?.map(tag => tag.text())
        .filter(isStringTag) || [];

    const patternText = tag.text('hidden', 'pattern');
    const pattern = patternText ? new RegExp(patternText) : undefined;

    hidden = {strings, pattern};
    hiddenFields.set(field.parentExplore, hidden);
  }
  return !!(hidden.pattern?.test(name) || hidden.strings.includes(name));
}

/**
 * Add `` around path elements that have special characters or are in
 * the list of reserved words
 * @param element A field path element
 * @returns A potentially quoted field path element
 */
export const quoteIfNecessary = (element: string) => {
  // Quote if contains non-word characters
  if (/\W/.test(element) || RESERVED.includes(element.toUpperCase())) {
    return `\`${element}\``;
  }
  return element;
};

/**
 * Retrieve a source from a model safely
 *
 * @param modelDef Model definition
 * @param sourceName Source name
 * @returns SourceDef for given name, or throws if not a source
 */

export const getSourceDef = (modelDef: ModelDef, sourceName: string) => {
  const result = modelDef.contents[sourceName];
  if (isSourceDef(result)) {
    return result;
  }
  throw new Error(`Not a source: ${sourceName}`);
};

const RESERVED: string[] = [
  'ALL',
  'AND',
  'AS',
  'ASC',
  'AVG',
  'BOOLEAN',
  'BY',
  'CASE',
  'CAST',
  'CONDITION',
  'COUNT',
  'DATE',
  'DAY',
  'DAYS',
  'DESC',
  'DISTINCT',
  'ELSE',
  'END',
  'EXCLUDE',
  'EXTEND',
  'FALSE',
  'FULL',
  'FOR',
  'FROM',
  'FROM_SQL',
  'HAS',
  'HOUR',
  'HOURS',
  'IMPORT',
  'INNER',
  'IS',
  'JSON',
  'LAST',
  'LEFT',
  'MAX',
  'MIN',
  'MINUTE',
  'MINUTES',
  'MONTH',
  'MONTHS',
  'NOT',
  'NOW',
  'NULL',
  'NUMBER',
  'ON',
  'OR',
  'PICK',
  'QUARTER',
  'QUARTERS',
  'RIGHT',
  'SECOND',
  'SECONDS',
  'STRING',
  'SOURCE_KW',
  'SUM',
  'SQL',
  'TABLE',
  'THEN',
  'THIS',
  'TIMESTAMP',
  'TO',
  'TRUE',
  'TURTLE',
  'WEEK',
  'WEEKS',
  'WHEN',
  'WITH',
  'YEAR',
  'YEARS',
  'UNGROUPED',
] as const;

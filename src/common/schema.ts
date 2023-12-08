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

import {Explore, Field, JoinRelationship} from '@malloydata/malloy';

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

const hiddenFields = new WeakMap<Explore, RegExp[]>();

const isStringTag = (tag: string | undefined): tag is string =>
  typeof tag === 'string';

const IS_REGEXP = /^\/(.*)\/$/;

export function isFieldHidden(field: Field): boolean {
  let hidden = hiddenFields.get(field.parentExplore);
  if (!hidden) {
    const hiddenTags =
      field.parentExplore
        .tagParse()
        .tag.array('hidden')
        ?.map(tag => tag.text())
        .filter(isStringTag) || [];

    hidden = hiddenTags.map(tag => {
      const regExpMatch = IS_REGEXP.exec(tag);
      if (regExpMatch) {
        return new RegExp(regExpMatch[1]);
      } else {
        return new RegExp(
          `^${tag.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`
        );
      }
    });
    hiddenFields.set(field.parentExplore, hidden);
  }
  return hidden.some(pattern => pattern.test(field.name));
}

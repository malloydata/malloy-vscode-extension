/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {applyValueChange} from '../../src/extension/webviews/connection_editor_page/value_change';

describe('applyValueChange', () => {
  it('sets a string value', () => {
    expect(applyValueChange({}, 'foo', 'bar')).toEqual({foo: 'bar'});
  });

  it('sets a boolean value', () => {
    expect(applyValueChange({}, 'flag', true)).toEqual({flag: true});
    expect(applyValueChange({}, 'flag', false)).toEqual({flag: false});
  });

  it('deletes the key when value is empty string', () => {
    expect(applyValueChange({foo: 'bar'}, 'foo', '')).toEqual({});
  });

  it('returns identity when deleting an absent key', () => {
    const prev = {a: 1};
    expect(applyValueChange(prev, 'b', '')).toBe(prev);
  });

  it('round-trips fill-then-erase to empty state', () => {
    let s: Record<string, string | number | boolean> = {};
    s = applyValueChange(s, 'text', 'hello');
    s = applyValueChange(s, 'flag', true);
    expect(s).toEqual({text: 'hello', flag: true});
    s = applyValueChange(s, 'text', '');
    expect(s).toEqual({flag: true});
    s = applyValueChange(s, 'flag', '');
    expect(s).toEqual({});
  });

  it('does not delete when value is false (legitimately set)', () => {
    const result = applyValueChange({flag: true}, 'flag', false);
    expect(result).toEqual({flag: false});
  });

  it('does not delete when value is 0 (legitimately set)', () => {
    const result = applyValueChange({n: 5}, 'n', 0);
    expect(result).toEqual({n: 0});
  });
});

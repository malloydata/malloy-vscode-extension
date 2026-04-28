/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

jest.mock(
  'vscode',
  () => ({
    window: {
      createOutputChannel: () => ({
        appendLine: jest.fn(),
        dispose: jest.fn(),
      }),
    },
  }),
  {virtual: true}
);

import {minimalEdit} from '../../src/extension/malloy_formatter';

function applyEdit(original: string, formatted: string): string {
  const edit = minimalEdit(original, formatted);
  if (edit === null) {
    return original;
  }
  return (
    original.slice(0, edit.start) + edit.newText + original.slice(edit.end)
  );
}

describe('minimalEdit', () => {
  it('returns null when text is unchanged', () => {
    expect(minimalEdit('source: x is 1\n', 'source: x is 1\n')).toBeNull();
  });

  it('replaces only the changed middle slice', () => {
    const edit = minimalEdit('a b c d e', 'a b XX d e');
    expect(edit).toEqual({start: 4, end: 5, newText: 'XX'});
  });

  it('handles pure insertion (formatted is longer)', () => {
    const edit = minimalEdit('ab', 'aXXb');
    expect(edit).toEqual({start: 1, end: 1, newText: 'XX'});
  });

  it('handles pure deletion (formatted is shorter)', () => {
    const edit = minimalEdit('aXXb', 'ab');
    expect(edit).toEqual({start: 1, end: 3, newText: ''});
  });

  it('handles complete replacement (no common prefix or suffix)', () => {
    const edit = minimalEdit('foo', 'bar');
    expect(edit).toEqual({start: 0, end: 3, newText: 'bar'});
  });

  it('does not let prefix and suffix overlap when one string is a substring of the other', () => {
    // "aaaa" vs "aa": prefix could greedily consume 2 and suffix
    // could also try to consume 2 — guard against double-counting.
    expect(applyEdit('aaaa', 'aa')).toBe('aa');
    expect(applyEdit('aa', 'aaaa')).toBe('aaaa');
  });

  it('reproduces formatted text for representative reformat cases', () => {
    const cases: Array<[string, string]> = [
      ['source: x is 1', 'source: x is 1\n'],
      ['source:x  is  1\n', 'source: x is 1\n'],
      ['a\nb\nc\n', 'a\n\nb\n\nc\n'],
      ['', 'x\n'],
      ['x\n', ''],
    ];
    for (const [original, formatted] of cases) {
      expect(applyEdit(original, formatted)).toBe(formatted);
    }
  });
});

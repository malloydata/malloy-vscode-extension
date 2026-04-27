/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export function applyValueChange(
  prev: Record<string, string | number | boolean>,
  propName: string,
  value: string | number | boolean
): Record<string, string | number | boolean> {
  if (value === '') {
    if (!(propName in prev)) return prev;
    const next = {...prev};
    delete next[propName];
    return next;
  }
  return {...prev, [propName]: value};
}

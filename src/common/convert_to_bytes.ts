/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

const BYTE_SUFFIXES = ['k', 'm', 'g', 't', 'p'];
const BYTE_MATCH = /^(?<bytes>\d+)((?<suffix>[kmgtp])((?<iec>i)?b)?)?$/i;

export const convertToBytes = (bytes: string): string => {
  const match = BYTE_MATCH.exec(bytes);
  if (match?.groups && match.groups['suffix']) {
    const value =
      +match.groups['bytes'] *
      Math.pow(
        1024,
        BYTE_SUFFIXES.indexOf(match.groups['suffix'].toLowerCase()) + 1
      );
    return `${value}`;
  }
  return bytes;
};

export const convertFromBytes = (bytes: number | string): string => {
  const value = Number(bytes);

  if (isNaN(value)) return String(bytes);

  let idx = 0;
  let suffix = '';
  let outVal = value;

  while (outVal >= 1024 && idx < BYTE_SUFFIXES.length) {
    outVal = value / Math.pow(1024, idx + 1);
    suffix = BYTE_SUFFIXES[idx++].toUpperCase();
  }
  return `${outVal.toLocaleString()}${suffix}B`;
};

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
  convertFromBytes,
  convertToBytes,
} from '../../src/common/convert_to_bytes';

describe('convertToBytes()', () => {
  it.each([
    ['numbers', ['1024', '1024'], ['20480', '20480'], ['409600', '409600']],
    ['kB', ['1k', '1024'], ['20kB', '20480'], ['400kib', '409600']],
    ['MB', ['1M', '1048576'], ['20MB', '20971520'], ['400mib', '419430400']],
    [
      'GB',
      ['1G', '1073741824'],
      ['20GB', '21474836480'],
      ['400gib', '429496729600'],
    ],
    [
      'TB',
      ['1T', '1099511627776'],
      ['20TB', '21990232555520'],
      ['400tib', '439804651110400'],
    ],
    [
      'PB',
      ['1P', '1125899906842624'],
      ['20PB', '22517998136852480'],
      ['400pib', '450359962737049600'],
    ],
    ['garbage', ['1F', '1F'], ['2KX', '2KX'], ['Fred', 'Fred']],
  ])('Handles %s', (_name, a, b, c) => {
    expect(convertToBytes(a[0])).toEqual(a[1]);
    expect(convertToBytes(b[0])).toEqual(b[1]);
    expect(convertToBytes(c[0])).toEqual(c[1]);
  });
});

describe('convertFromBytes()', () => {
  it.each([
    ['numbers', ['256B', '256'], ['500B', '500'], ['1,000B', '1000']],
    ['KB', ['1KB', '1024'], ['20KB', '20480'], ['400KB', '409600']],
    ['MB', ['1MB', '1048576'], ['20MB', '20971520'], ['400MB', '419430400']],
    [
      'GB',
      ['1GB', '1073741824'],
      ['20GB', '21474836480'],
      ['400GB', '429496729678'],
    ],
    [
      'TB',
      ['1TB', '1099511627776'],
      ['20TB', '21990232555520'],
      ['400TB', '439804651110436'],
    ],
    [
      'PB',
      ['1PB', '1125899906842624'],
      ['20PB', '22517998136852480'],
      ['400PB', '450359962737049671'],
    ],
    ['garbage', ['1F', '1F'], ['2KX', '2KX'], ['Fred', 'Fred']],
  ])('Handles %s', (_name, a, b, c) => {
    expect(convertFromBytes(a[1])).toEqual(a[0]);
    expect(convertFromBytes(b[1])).toEqual(b[0]);
    expect(convertFromBytes(c[1])).toEqual(c[0]);
  });
});

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import madge from 'madge';
import 'jest-expect-message';

describe('dependencies', () => {
  function getMessage(circles: string[][]): string {
    let message = 'Circular References:\n';
    for (const circle of circles) {
      message += '    ';
      for (const dep of circle) {
        message += `${dep} -> `;
      }
      message += `${circle[0]}\n`;
    }
    return message;
  }

  it('typescript references should not be circular', async () => {
    const deps = await madge('.', {
      fileExtensions: ['ts'],
    });
    expect(deps.circular().length, getMessage(deps.circular())).toBe(0);
  });
});

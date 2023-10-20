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

import {NodeMessageHandler} from './message_handler';

export const messageHandler = new NodeMessageHandler();

const logPrefix = (level: string) => {
  const stamp = new Date().toLocaleTimeString();
  return `[${level} - ${stamp}]`;
};

// eslint-disable-next-line no-console
console.log = (...args: unknown[]) =>
  messageHandler.log(logPrefix('Log'), ...args);
console.debug = (...args: unknown[]) =>
  messageHandler.log(logPrefix('Debug'), ...args);
console.info = (...args: unknown[]) =>
  messageHandler.log(logPrefix('Info'), ...args);
console.warn = (...args: unknown[]) =>
  messageHandler.log(logPrefix('Warn'), ...args);
console.error = (...args: unknown[]) =>
  messageHandler.log(logPrefix('Error'), ...args);

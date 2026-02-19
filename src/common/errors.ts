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

export const errorMessage = (error: unknown): string => {
  let message = '';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } else if (error && typeof error === 'object') {
    // Handle case when its an instance of Error but it is not detecting it
    // as such, or LSP ResponseError objects with data/message fields.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = error as any;
    if (typeof obj.message === 'string' && obj.message) {
      message = obj.message;
    } else if (typeof obj.data === 'string' && obj.data) {
      message = obj.data;
    } else {
      try {
        message = JSON.stringify(error);
      } catch {
        // ignore
      }
    }
  }
  if (!message) {
    console.error('Unknown error object:', error);
    message = 'Something went wrong';
  }
  return message;
};

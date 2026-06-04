/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export const errorMessage = (error: unknown): string => {
  let message = 'Something went wrong';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
    // Handle case when its an instance of Error but it is not detecting it as such.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } else if ((error as any).message) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    message = (error as any).message;
  } else {
    console.error(error);
  }
  return message;
};

/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export interface MalloyRendererMessage {
  command: string;
  args: unknown[];
}

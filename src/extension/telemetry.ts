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

import * as vscode from 'vscode';
import {getMalloyConfig} from './utils/config';

const telemetryLog = vscode.window.createOutputChannel('Malloy Telemetry');

function isTelemetryEnabled() {
  const vsCodeValue = vscode.env.isTelemetryEnabled;
  const configValue = getMalloyConfig().get('telemetry') ?? false;
  return vsCodeValue && configValue;
}

export interface TrackingEvent {
  name: string;
  params: Record<string, string>;
}

async function track(event: TrackingEvent) {
  if (!isTelemetryEnabled()) return;

  telemetryLog.appendLine(`Logging telemetry event: ${JSON.stringify(event)}.`);

  // Telemetry disabled
}

export function trackQueryRun({
  dialect: _dialect,
}: {
  dialect: string;
}): Promise<void> {
  return track({
    name: 'query_run',
    params: {},
  });
}

export function trackModelLoad(): Promise<void> {
  return track({
    name: 'model_load',
    params: {},
  });
}

export function trackModelSave(): Promise<void> {
  return track({
    name: 'model_save',
    params: {},
  });
}

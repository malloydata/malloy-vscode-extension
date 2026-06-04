/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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

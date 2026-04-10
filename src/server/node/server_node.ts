/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DidChangeConfigurationParams} from 'vscode-languageserver';
import {createConnection, ProposedFeatures} from 'vscode-languageserver/node';
import {initServer} from '../init';
import {CommonConnectionManager} from '../../common/connection_manager';
import {NodeConnectionFactory} from '../connections/node/connection_factory';
import {NodeMessageHandler} from '../../worker/node/message_handler';
import * as os from 'os';
import {pathToFileURL} from 'url';

export interface CloudCodeConfig {
  project?: string;
  cloudshell?: {
    project?: string;
  };
}

const onDidChangeConfiguration = (change: DidChangeConfigurationParams) => {
  const cloudCodeConfig = change.settings.cloudcode as
    | CloudCodeConfig
    | undefined;
  const cloudCodeProject = cloudCodeConfig?.project;
  const cloudShellProject = cloudCodeConfig?.cloudshell?.project;

  const project = cloudCodeProject || cloudShellProject;

  if (project && typeof project === 'string') {
    process.env['DEVSHELL_PROJECT_ID'] = project;
    process.env['GOOGLE_CLOUD_PROJECT'] = project;
    process.env['GOOGLE_CLOUD_QUOTA_PROJECT'] = project;
  }
};

const connection = createConnection(ProposedFeatures.all);
const connectionManager = new CommonConnectionManager(
  new NodeConnectionFactory(),
  {
    expandHome: (path: string) => path.replace(/^~/, os.homedir()),
    pathToFileURL: (path: string) => pathToFileURL(path),
  }
);

initServer(connection, connectionManager, onDidChangeConfiguration);
export const messageHandler = new NodeMessageHandler(
  connection,
  connectionManager
);

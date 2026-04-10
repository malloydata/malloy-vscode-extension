/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  createConnection,
  BrowserMessageReader,
  BrowserMessageWriter,
} from 'vscode-languageserver/browser';
import {initServer} from '../init';
import {CommonConnectionManager} from '../../common/connection_manager';
import {WebConnectionFactory} from '../connections/browser/connection_factory';
import {MessageHandler} from '../../worker/message_handler';

const messageReader = new BrowserMessageReader(self as unknown as Worker);
const messageWriter = new BrowserMessageWriter(self as unknown as Worker);

const connection = createConnection(messageReader, messageWriter);
const connectionManager = new CommonConnectionManager(
  new WebConnectionFactory(connection)
  // No hostAdapter — browser has no tilde expansion
);

initServer(connection, connectionManager);
new MessageHandler(connection, connectionManager);

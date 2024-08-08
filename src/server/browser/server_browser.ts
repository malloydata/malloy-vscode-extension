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
  createConnection,
  BrowserMessageReader,
  BrowserMessageWriter,
} from 'vscode-languageserver/browser';
import {initServer} from '../init';
import {ConnectionManager} from '../../common/connection_manager';
import {WebConnectionFactory} from '../connections/browser/connection_factory';
import {MessageHandler} from '../../worker/message_handler';

const messageReader = new BrowserMessageReader(self as unknown as Worker);
const messageWriter = new BrowserMessageWriter(self as unknown as Worker);

const connection = createConnection(messageReader, messageWriter);
const connectionManager = new ConnectionManager(
  new WebConnectionFactory(connection)
);

interface DocumentShim {
  document: unknown;
}

// Hack to support the MotherDuck wasm bundle which uses document.postMessage()
if (typeof globalThis !== 'undefined' && typeof document === 'undefined') {
  (globalThis as DocumentShim).document = globalThis;
}

initServer(connection, connectionManager);
new MessageHandler(connection, connectionManager);

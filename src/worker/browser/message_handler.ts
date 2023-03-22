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
/* eslint-disable no-console */

import {log} from '../logger';
import {cancelQuery, runQuery} from '../run_query';
// TODO(web) import { downloadQuery } from "./download_query";
import {
  Message,
  MessageHandler,
  WorkerMessage,
} from '../../common/worker_message_types';
import {refreshConfig} from '../refresh_config';
import {ConnectionManager} from '../../common/connection_manager';
import {fetchCellData, WorkerURLReader} from './files';

export class BrowserMessageHandler implements MessageHandler {
  constructor(connectionManager: ConnectionManager) {
    log('Worker started');
    self.postMessage({type: 'started'});

    const reader = new WorkerURLReader();

    const heartBeat = setInterval(() => {
      log('Heartbeat');
    }, 60 * 1000);

    self.addEventListener('message', (event: MessageEvent) => {
      const message: Message = event.data;
      console.info('Worker received', message);

      switch (message.type) {
        case 'cancel':
          cancelQuery(message);
          break;
        case 'config':
          refreshConfig(connectionManager, message);
          break;
        // TODO(web)
        // case "download":
        //   downloadQuery(connectionManager, message);
        //   break;
        case 'exit':
          clearInterval(heartBeat);
          break;
        case 'run':
          runQuery(
            this,
            reader,
            connectionManager,
            true,
            message,
            fetchCellData
          );
          break;
      }
    });
  }

  send(message: WorkerMessage) {
    self.postMessage(message);
  }
}

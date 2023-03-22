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

import {log} from '../logger';
import {cancelQuery, runQuery} from '../run_query';
import {downloadQuery} from './download_query';
import {
  Message,
  MessageHandler,
  WorkerMessage,
} from '../../common/worker_message_types';
import {refreshConfig} from '../refresh_config';
import {ConnectionManager} from '../../common/connection_manager';
import {WorkerURLReader, fetchCellData} from './files';

export class NodeMessageHandler implements MessageHandler {
  constructor(connectionManager: ConnectionManager) {
    log('Worker started');
    const reader = new WorkerURLReader();

    process.send?.({type: 'started'});

    const heartBeat = setInterval(() => {
      log('Heartbeat');
    }, 60 * 1000);

    process.on('message', (message: Message) => {
      switch (message.type) {
        case 'cancel':
          cancelQuery(message);
          break;
        case 'config':
          refreshConfig(connectionManager, message);
          break;
        case 'download':
          downloadQuery(connectionManager, message, fetchCellData);
          break;
        case 'exit':
          clearInterval(heartBeat);
          break;
        case 'run':
          runQuery(
            this,
            reader,
            connectionManager,
            false,
            message,
            fetchCellData
          );
          break;
      }
    });

    process.on('exit', () => {
      log('Worker exited');
    });

    process.on('SIGHUP', () => {
      clearInterval(heartBeat);
    });
  }

  send(message: WorkerMessage) {
    process.send?.(message);
  }
}

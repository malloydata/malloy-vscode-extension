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

import React from 'react';
import styled from 'styled-components';
import * as rpc from 'vscode-jsonrpc/browser';
import {
  ComposerMessage,
  ComposerMessageType,
} from '../../../common/message_types';

export const App = () => {
  const [port, setPort] = React.useState(0);

  React.useEffect(() => {
    const listener = (event: MessageEvent<ComposerMessage>) => {
      if (event.data.type === ComposerMessageType.ComposerReady) {
        setPort(event.data.port);
      }
    };

    window.addEventListener('message', listener);
    return () => {
      window.removeEventListener('message', listener);
    };
  });

  const setIframeRef = React.useCallback(iframe => {
    const onload = () => {
      const channel = new MessageChannel();
      const connection = rpc.createMessageConnection(
        new rpc.BrowserMessageReader(channel.port1),
        new rpc.BrowserMessageWriter(channel.port1),
        console
      );
      connection.onNotification('ready', () => {
        console.log('ready');
      });
      connection.listen();
      iframe.contentWindow.postMessage({type: 'ready'}, '*', [channel.port2]);
    };

    if (iframe) {
      iframe.addEventListener('load', onload);
      return () => {
        iframe.removeEventListener('load', onload);
      };
    }
  }, []);

  if (port) {
    return (
      <Frame ref={setIframeRef} src={`http://localhost:${port}`}>
        Hello
      </Frame>
    );
  }

  return null;
};

const Frame = styled.iframe`
  width: 100vw;
  height: 100vh;
  border: 0;
`;

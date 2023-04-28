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

import React, {
  DOMElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import styled from 'styled-components';
import {
  SQLQueryMessageType,
  SQLQueryPanelMessage,
  SQLQueryRunStatus,
} from '../../../common/message_types';
import {Spinner} from '../components';
import {useQueryVSCodeContext} from './sql_query_vscode_context';
import {Scroll} from '../components/Scroll';

enum Status {
  Ready = 'ready',
  Running = 'running',
  Error = 'error',
  Displaying = 'displaying',
  Rendering = 'rendering',
  Done = 'done',
}

export const App: React.FC = () => {
  const [status, setStatus] = useState<Status>(Status.Ready);
  const [html, setHTML] = useState<HTMLElement>(document.createElement('span'));
  const [error, setError] = useState<string | undefined>(undefined);
  const [warning, setWarning] = useState<string | undefined>(undefined);
  const [darkMode, setDarkMode] = useState(false);
  const [observer, setObserver] = useState<MutationObserver>();

  const vscode = useQueryVSCodeContext();

  useEffect(() => {
    vscode.postMessage({type: 'app-ready'} as SQLQueryPanelMessage);
  }, []);

  const themeCallback = useCallback(() => {
    const themeKind = document.body.dataset['vscodeThemeKind'];
    setDarkMode(themeKind === 'vscode-dark');
  }, []);

  useEffect(() => {
    const obs = new MutationObserver(themeCallback);
    setObserver(obs);
  }, [themeCallback, setObserver]);

  useEffect(() => {
    if (!observer) return;
    observer.observe(document.body, {
      attributeFilter: ['data-vscode-theme-kind'],
    });
    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [observer, document.body]);

  useEffect(() => {
    const listener = (event: MessageEvent<SQLQueryPanelMessage>) => {
      const message = event.data;

      if (message.type !== SQLQueryMessageType.QueryStatus) return;

      if (message.status === SQLQueryRunStatus.Error) {
        setStatus(Status.Error);
        setError(message.error);
      } else {
        setError(undefined);
      }

      if (message.status === SQLQueryRunStatus.Done) {
        setWarning(undefined);
        setStatus(Status.Rendering);
        setTimeout(async () => {
          const results = message.results;
          const rendered = null; //TODO
          setStatus(Status.Displaying);
          setTimeout(() => {
            setHTML(rendered);
            setStatus(Status.Done);
          }, 0);
        }, 0);
      } else if (message.status === SQLQueryRunStatus.Running) {
        setHTML(document.createElement('span'));
        setStatus(Status.Running);
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  });

  return (
    <div
      style={{
        height: '100%',
        margin: '0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {[Status.Running, Status.Rendering, Status.Displaying].includes(
        status
      ) ? (
        <Spinner text={getStatusLabel(status) || ''} />
      ) : (
        ''
      )}
      {!error && [Status.Displaying, Status.Done].includes(status) && (
        <ResultControlsBar>
          <ResultLabel>QUERY RESULTS</ResultLabel>
        </ResultControlsBar>
      )}
      {!error && (
        <Scroll>
          <div style={{margin: '10px'}}>
            <DOMElement element={html} />
          </div>
        </Scroll>
      )}
      {error && <Error multiline={error.includes('\n')}>{error}</Error>}
      {warning && <Warning>{warning}</Warning>}
    </div>
  );
};

function getStatusLabel(status: Status) {
  switch (status) {
    case Status.Running:
      return 'Running';
    case Status.Rendering:
      return 'Rendering';
    case Status.Displaying:
      return 'Displaying';
  }
}

function getStyledHTML(html: HTMLElement): string {
  const resolveStyles = getComputedStyle(html);
  const styles = `<style>
  :root {
    --malloy-font-family: ${resolveStyles.getPropertyValue(
      '--malloy-font-family'
    )};
    --malloy-title-color: ${resolveStyles.getPropertyValue(
      '--malloy-title-color'
    )};
    --malloy-label-color: ${resolveStyles.getPropertyValue(
      '--malloy-label-color'
    )};
    --malloy-border-color: ${resolveStyles.getPropertyValue(
      '--malloy-border-color'
    )};
    --malloy-tile-background-color: ${resolveStyles.getPropertyValue(
      '--malloy-tile-background-color'
    )};
  }
  body {
    color: ${resolveStyles.getPropertyValue('--foreground')};
    background: ${resolveStyles.getPropertyValue('--background')};
    font-family: var(--malloy-font-family);
    font-size: 11px;
  }
  table {
    font-size: 11px;
  }
</style>
`;
  return styles + html.outerHTML;
}

const DOMElement: React.FC<{element: HTMLElement}> = ({element}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = ref.current;
    if (parent) {
      parent.innerHTML = '';
      parent.appendChild(element);
    }
  }, [element]);

  return <div style={{fontSize: 11}} ref={ref}></div>;
};

const Warning = styled.div`
  color: var(--vscode-statusBarItem-warningForeground);
  background-color: var(--vscode-statusBarItem-warningBackground);
  padding: 5px;
`;

interface ErrorProps {
  multiline: boolean;
}

const Error = styled.div<ErrorProps>`
  background-color: var(--vscode-inputValidation-errorBackground);
  padding: 5px;
  white-space: ${props => (props.multiline ? 'pre' : 'normal')};
  font-family: ${props => (props.multiline ? 'monospace' : 'inherit')};
  font-size: var(--vscode-editor-font-size);
`;

const ResultControlsBar = styled.div`
  display: flex;
  border-bottom: 1px solid #efefef;
  justify-content: space-between;
  align-items: center;
  color: #b1b1b1;
  padding: 0 10px;
  user-select: none;
`;

const ResultLabel = styled.span`
  font-weight: 500;
  font-size: 12px;
`;

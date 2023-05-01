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
import {Result} from '@malloydata/malloy';
import {HTMLView} from '@malloydata/render';
import {ResultKind, ResultKindToggle} from './ResultKindToggle';
import {PrismContainer} from '../components/PrismContainer';
import Prism from 'prismjs';

enum Status {
  Ready = 'ready',
  Running = 'running',
  Error = 'error',
  Compiling = 'compiling',
  Displaying = 'displaying',
  Rendering = 'rendering',
  Done = 'done',
}

export const App: React.FC = () => {
  const [status, setStatus] = useState<Status>(Status.Ready);
  const [resultKind, setResultKind] = useState<ResultKind>(ResultKind.HTML);
  const [html, setHTML] = useState<HTMLElement>(document.createElement('span'));
  const [sql, setSQL] = useState('');
  const [showOnlySQL, setShowOnlySQL] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [observer, setObserver] = useState<MutationObserver>();
  const [error, setError] = useState<string | undefined>(undefined);
  const [warning, setWarning] = useState<string | undefined>(undefined);

  const vscode = useQueryVSCodeContext();

  useEffect(() => {
    vscode.postMessage({type: 'app-ready'} as SQLQueryPanelMessage);
  }, []);

  const themeCallback = useCallback(() => {
    const themeKind = document.body.dataset['vscodeThemeKind'];
    setDarkMode(themeKind === 'vscode-dark');
  }, []);

  useEffect(() => {
    themeCallback();
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
        if (message.sql) {
          setError(
            `${message.error}\n\n${'-'.repeat(10)}Generated SQL${'-'.repeat(
              10
            )}\n\n${message.sql
              .split('\n')
              .map((line, index) => `${index + 1}| ${line}`)
              .join('\n')}`
          );
        } else setError(message.error);
        return;
      } else {
        setError(undefined);
      }

      switch (message.status) {
        case SQLQueryRunStatus.Compiling:
          setSQL('');
          setShowOnlySQL(false);
          setWarning(undefined);
          setResultKind(ResultKind.HTML);
          setHTML(document.createElement('span'));
          setStatus(Status.Compiling);
          break;
        case SQLQueryRunStatus.Compiled:
          setSQL(message.sql);
          if (message.showSQLOnly) {
            setShowOnlySQL(true);
            setStatus(Status.Done);
            setResultKind(ResultKind.SQL);
          }
          break;
        case SQLQueryRunStatus.Done:
          setWarning(undefined);
          setStatus(Status.Rendering);
          setTimeout(async () => {
            if (message.results) {
              const results = Result.fromJSON(message.results);
              const data = results.data;
              const rendered = await new HTMLView(document).render(data, {
                dataStyles: {},
              });
              setStatus(Status.Displaying);
              setTimeout(async () => {
                setHTML(rendered);
                setStatus(Status.Done);
              }, 0);
            } else {
              // no message means nothing to render'
              const span = document.createElement('span');
              span.innerText = 'Query complete';
              setHTML(span);
            }
          }, 0);
          break;
        case SQLQueryRunStatus.Running:
          setHTML(document.createElement('span'));
          setStatus(Status.Running);
          break;
        default:
          break;
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
      {[
        Status.Compiling,
        Status.Running,
        Status.Rendering,
        Status.Displaying,
      ].includes(status) ? (
        <Spinner text={getStatusLabel(status) || ''} />
      ) : (
        ''
      )}
      {!error && [Status.Displaying, Status.Done].includes(status) && (
        <ResultControlsBar>
          <ResultLabel>{showOnlySQL ? 'SQL' : 'QUERY RESULTS'}</ResultLabel>
          {!showOnlySQL && (
            <ResultControlsItems>
              <ResultKindToggle kind={resultKind} setKind={setResultKind} />
            </ResultControlsItems>
          )}
        </ResultControlsBar>
      )}
      {!error && resultKind === ResultKind.HTML && (
        <Scroll>
          <div style={{margin: '10px'}}>
            <DOMElement element={html} />
          </div>
        </Scroll>
      )}
      {!error && resultKind === ResultKind.SQL && (
        <Scroll>
          <PrismContainer darkMode={darkMode} style={{margin: '10px'}}>
            <div
              dangerouslySetInnerHTML={{
                __html: Prism.highlight(sql, Prism.languages['sql'], 'sql'),
              }}
              style={{margin: '10px', whiteSpace: 'break-spaces'}}
            />
          </PrismContainer>
        </Scroll>
      )}
      {error && <Error multiline={error.includes('\n')}>{error}</Error>}
      {warning && <Warning>{warning}</Warning>}
    </div>
  );
};

function getStatusLabel(status: Status) {
  switch (status) {
    case Status.Compiling:
      return 'Compiling';
    case Status.Running:
      return 'Running';
    case Status.Rendering:
      return 'Rendering';
    case Status.Displaying:
      return 'Displaying';
  }
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
  white-space: break-spaces;
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

const ResultControlsItems = styled.div`
  display: flex;
  align-items: center;
`;

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

import React, {useCallback, useEffect, useRef, useState} from 'react';
import styled from 'styled-components';
import {
  EvaluatedMSQLStatement,
  EvaluatedMSQLStatementType,
  ExecutedMSQLStatementResultType,
  MSQLMessageStatus,
  MSQLQueryRunStatus,
  QueryMessageType,
} from '../../../common/message_types';
import {Spinner} from '../components';
import {useQueryVSCodeContext} from './msql_query_vscode_context';
import {Scroll} from '../components/Scroll';
import {HTMLView} from '@malloydata/render';
import {ResultKind, ResultKindToggle} from './ResultKindToggle';
import {PrismContainer} from '../components/PrismContainer';
import Prism from 'prismjs';
import {Result} from '@malloydata/malloy';

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
  const [resultKind, setResultKind] = useState<ResultKind>(ResultKind.RESULTS);
  const [evaluatedStatements, setEvaluatedStatements] = useState<
    EvaluatedMSQLStatement[]
  >([]);

  const [statementIndex, setStatementIndex] = useState(0);
  const [showOnlySQL, setShowOnlySQL] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [observer, setObserver] = useState<MutationObserver>();
  const [error, setError] = useState<string | undefined>(undefined);
  const [warning, setWarning] = useState<string | undefined>(undefined);

  const vscode = useQueryVSCodeContext();

  useEffect(() => {
    vscode.postMessage({type: QueryMessageType.AppReady});
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
    const listener = (event: MessageEvent<MSQLMessageStatus>) => {
      const message = event.data;

      if (message.status === MSQLQueryRunStatus.Error) {
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
        case MSQLQueryRunStatus.Compiling:
          setShowOnlySQL(false);
          setWarning(undefined);
          setResultKind(ResultKind.RESULTS);
          setEvaluatedStatements([]);
          setStatementIndex(message.statementIndex);
          setStatus(Status.Compiling);
          break;
        case MSQLQueryRunStatus.Running:
          setStatementIndex(message.statementIndex);
          setEvaluatedStatements([]);
          setStatus(Status.Running);
          break;
        case MSQLQueryRunStatus.Done:
          setWarning(undefined);
          setStatus(Status.Rendering);
          setShowOnlySQL(message.showSQLOnly || false);
          setResultKind(
            message.showSQLOnly ? ResultKind.SQL : ResultKind.RESULTS
          );
          setTimeout(async () => {
            let errorCount = 0;
            for (const evaluatedStatement of message.results) {
              if (
                evaluatedStatement.type === EvaluatedMSQLStatementType.Executed
              ) {
                if (
                  evaluatedStatement.resultType ===
                  ExecutedMSQLStatementResultType.WithStructdef
                ) {
                  const result = Result.fromJSON(evaluatedStatement.results);
                  const renderedTable = await new HTMLView(document).render(
                    result,
                    {
                      dataStyles: {},
                    }
                  );
                  const html = document.createElement('div');
                  html.style.fontSize = '11px';
                  html.appendChild(renderedTable);
                  evaluatedStatement.renderedHTML = html;
                } else if (evaluatedStatement.results.rows.length === 0) {
                  const html = document.createElement('span');
                  html.innerText = 'Statement completed';
                  evaluatedStatement.renderedHTML = html;
                } else {
                  const html = document.createElement('span');
                  html.innerText = evaluatedStatement.results.rows
                    .map(row => JSON.stringify(row))
                    .join('\n');
                  evaluatedStatement.renderedHTML = html;
                }
              } else if (
                evaluatedStatement.type ===
                EvaluatedMSQLStatementType.ExecutionError
              ) {
                evaluatedStatement.prettyError = `Execution error in statement ${
                  statementIndex + 1
                } (line ${evaluatedStatement.statementFirstLine}):\n${
                  evaluatedStatement.error
                }\n\n${'-'.repeat(10)}Generated SQL${'-'.repeat(
                  10
                )}\n\n${evaluatedStatement.compiledStatement
                  .split('\n')
                  .map((line, index) => `${index + 1}| ${line}`)
                  .join('\n')}`;
              } else if (
                evaluatedStatement.type ===
                EvaluatedMSQLStatementType.CompileError
              ) {
                errorCount += 1;
              } else if (
                evaluatedStatement.type === EvaluatedMSQLStatementType.Compiled
              ) {
                const html = document.createElement('span');
                html.innerText = 'Compiled successfully';
                evaluatedStatement.renderedHTML = html;
              }
            }

            if (errorCount)
              setWarning(
                `${errorCount} statement${
                  errorCount > 1 ? 's' : ''
                } did not compile successfully`
              );

            setStatus(Status.Displaying);
            setTimeout(async () => {
              setEvaluatedStatements(message.results);
              setStatus(Status.Done);
            }, 0);
          }, 0);
          break;
        default:
          setEvaluatedStatements([]);
          setShowOnlySQL(false);
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
        <Spinner text={getStatusLabel(status, statementIndex) || ''} />
      ) : (
        ''
      )}
      {!error && [Status.Displaying, Status.Done].includes(status) && (
        <ResultControlsBar>
          <ResultLabel>
            {showOnlySQL ? 'COMPILED SQL' : 'QUERY RESULTS'}
          </ResultLabel>
          {!showOnlySQL && (
            <ResultControlsItems>
              <ResultKindToggle kind={resultKind} setKind={setResultKind} />
            </ResultControlsItems>
          )}
        </ResultControlsBar>
      )}
      {!error && resultKind === ResultKind.RESULTS && (
        <Scroll>
          {evaluatedStatements.map(result => {
            return (
              <ResultsContainer key={result.statementIndex}>
                {(result.type === EvaluatedMSQLStatementType.Executed ||
                  result.type === EvaluatedMSQLStatementType.Compiled) &&
                  result.renderedHTML && (
                    <div style={{margin: '10px'}}>
                      <DOMElement element={result.renderedHTML} />
                    </div>
                  )}
                {result.type === EvaluatedMSQLStatementType.ExecutionError && (
                  <Error multiline={true}>{result.prettyError}</Error>
                )}
                {result.type === EvaluatedMSQLStatementType.CompileError &&
                  result.errors.map((compileError, index) => {
                    return (
                      <Error multiline={true} key={index}>
                        {compileError.problems
                          .map(error => error.message)
                          .join('\n')}
                      </Error>
                    );
                  })}
              </ResultsContainer>
            );
          })}
        </Scroll>
      )}

      {!error && resultKind === ResultKind.SQL && (
        <Scroll>
          {evaluatedStatements.map(result => {
            return (
              <ResultsContainer key={result.statementIndex}>
                {(result.type === EvaluatedMSQLStatementType.Executed ||
                  result.type === EvaluatedMSQLStatementType.Compiled) && (
                  <PrismContainer darkMode={darkMode} style={{margin: '10px'}}>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: Prism.highlight(
                          result.compiledStatement,
                          Prism.languages['sql'],
                          'sql'
                        ),
                      }}
                      style={{margin: '10px', whiteSpace: 'break-spaces'}}
                    />
                  </PrismContainer>
                )}
                {result.type === EvaluatedMSQLStatementType.ExecutionError && (
                  <Error multiline={true}>{result.prettyError}</Error>
                )}
                {result.type === EvaluatedMSQLStatementType.CompileError &&
                  result.errors.map((compileError, index) => {
                    return (
                      <Error multiline={true} key={index}>
                        {compileError.problems
                          .map(error => error.message)
                          .join('\n')}
                      </Error>
                    );
                  })}
              </ResultsContainer>
            );
          })}
        </Scroll>
      )}
      {error && <Error multiline={error.includes('\n')}>{error}</Error>}
      {warning && <Warning>{warning}</Warning>}
    </div>
  );
};

function getStatusLabel(status: Status, statementIndex: number) {
  switch (status) {
    case Status.Compiling:
      return `Compiling Statement ${statementIndex + 1}`;
    case Status.Running:
      return `Running Statement ${statementIndex + 1}`;
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

  return <div ref={ref} />;
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
  border-bottom: 1px solid var(--vscode-notifications-border);
  justify-content: space-between;
  align-items: center;
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

const ResultsContainer = styled.div`
  border-bottom: 1px solid var(--vscode-notifications-border);
  font-family: var(--vscode-editor-font-family);
  font-size: var(--vscode-editor-font-size);
  padding: 12px 12px;
`;

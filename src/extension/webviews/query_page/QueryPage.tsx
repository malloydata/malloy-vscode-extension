/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {useCallback, useEffect, useState} from 'react';
import {
  Explore,
  Field,
  NamedQuery,
  QueryField,
  Result,
} from '@malloydata/malloy';
import {HTMLView, getMalloyRenderHTML} from '@malloydata/render';
import '@malloydata/render/webcomponent';

import {
  QueryDownloadCopyData,
  QueryDownloadOptions,
  QueryMessageStatus,
  QueryMessageType,
  QueryPanelMessage,
  QueryRunStats,
  QueryRunStatus,
} from '../../../common/types/message_types';
import {fieldType, quoteIfNecessary} from '../../../common/schema';

import {
  ResultKind,
  ResultKindToggle,
  resultKindFromString,
} from './ResultKindToggle';
import {VsCodeApi} from '../vscode_wrapper';
import {convertFromBytes} from '../../../common/convert_to_bytes';

import {LabeledSpinner} from '../components/LabeledSpinner';
import {SchemaRenderer} from '../components/SchemaRenderer';
import '../components/prism_container';
import {CopyButton as CopyButtonInner} from './CopyButton';
import {DownloadButton} from './DownloadButton';
import {ErrorPanel} from './ErrorPanel';
import styled from 'styled-components';
import {CodeContainer} from '../components/CodeContainer';
import {DOMElement} from '../components/DOMElement';

interface Results {
  canDownloadStream?: boolean;
  stats?: QueryRunStats;
  name?: string;
  result?: Result;
  html?: HTMLElement;
  sql?: string;
  json?: string;
  metadata?: string;
  schema?: Explore[];
  profilingUrl?: string;
  queryCostBytes?: number;
  warning?: string;
}

export interface QueryPageProps {
  vscode: VsCodeApi<QueryPanelMessage, void>;
}

export function QueryPage({vscode}: QueryPageProps) {
  const [resultKind, setResultKind] = useState(ResultKind.HTML);
  const [availableKinds, setAvailableKinds] = useState<ResultKind[]>([]);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<Results>({});
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    setIsDarkMode(document.body.dataset['vscodeThemeKind'] === 'vscode-dark');
  }, []);

  const copyToClipboard = useCallback(
    (text: string, type: string) => {
      const status = QueryRunStatus.RunCommand;
      const command = 'malloy.copyToClipboard';
      const args = [text, type];
      vscode.postMessage({status, command, args});
    },
    [vscode]
  );

  const onMessage = useCallback(
    (event: MessageEvent<QueryMessageStatus>) => {
      const message = event.data;
      const {status} = message;

      switch (status) {
        case QueryRunStatus.Compiling:
          setError('');
          setResults({});
          setAvailableKinds([]);
          setProgressMessage('Compiling');
          break;
        case QueryRunStatus.Running:
          setProgressMessage('Running');
          break;
        case QueryRunStatus.Error:
          setError(message.error);
          break;
        case QueryRunStatus.Compiled:
          if (message.showSQLOnly) {
            setProgressMessage('');
            setAvailableKinds([ResultKind.SQL]);
            setResultKind(ResultKind.SQL);
            setResults({sql: message.sql});
          } else {
            setProgressMessage('Compiled');
          }
          break;
        case QueryRunStatus.EstimatedCost:
          {
            const {queryCostBytes, schema} = message;
            setProgressMessage('');
            setResults({
              ...results,
              queryCostBytes,
              schema: schema.map(json => Explore.fromJSON(json)),
            });
          }
          break;
        case QueryRunStatus.Schema:
          {
            const {schema} = message;
            setProgressMessage('');
            setResults({
              ...results,
              schema: schema.map(json => Explore.fromJSON(json)),
            });
            setResultKind(ResultKind.SCHEMA);
            setAvailableKinds([ResultKind.SCHEMA]);
          }
          break;
        case QueryRunStatus.Done: {
          const {
            canDownloadStream,
            resultJson,
            defaultTab,
            name,
            stats,
            profilingUrl,
          } = message;

          const defaultKind = resultKindFromString(defaultTab);
          if (defaultKind) {
            setResultKind(defaultKind);
          }

          const isPreview =
            defaultKind === ResultKind.PREVIEW ||
            defaultKind === ResultKind.SCHEMA;

          if (isPreview) {
            setAvailableKinds([
              ResultKind.SCHEMA,
              ResultKind.PREVIEW,
              ResultKind.METADATA,
            ]);
          } else {
            setAvailableKinds([
              ResultKind.HTML,
              ResultKind.JSON,
              ResultKind.METADATA,
              ResultKind.SCHEMA,
              ResultKind.SQL,
            ]);
          }
          const result = Result.fromJSON(resultJson);
          const {data, sql} = result;

          let warning: string | undefined;
          if (data.rowCount < result.totalRows) {
            const rowCount = data.rowCount.toLocaleString();
            const totalRows = result.totalRows.toLocaleString();
            warning = `Row limit hit. Viewing ${rowCount} of ${totalRows} results.`;
          }

          const queryCostBytes = result.runStats?.queryCostBytes;
          const json = JSON.stringify(data.toObject(), null, 2);

          const schema =
            isPreview && result.resultExplore.parentExplore
              ? [result.resultExplore.parentExplore]
              : [result.resultExplore];

          let metadata: string;
          if (isPreview) {
            metadata = JSON.stringify(schema[0], null, 2);
          } else {
            const {
              sql: _s,
              result: _r,
              ...metadataOnly
            } = resultJson.queryResult;
            metadata = JSON.stringify(metadataOnly, null, 2);
          }

          const currentResults = {
            json,
            name,
            result,
            schema,
            sql,
            metadata,
            profilingUrl,
            queryCostBytes,
            stats,
            // TODO(whscullin) Lens Query Panel
            // Fix canDownload/canDownload stream distinction
            canDownloadStream,
            warning,
          };

          setResults(currentResults);

          setProgressMessage('Rendering');
          new HTMLView(document)
            .render(result, {
              dataStyles: {},
              isDrillingEnabled: true,
              onDrill: (
                drillQuery: string,
                _target: HTMLElement,
                _drillFilters: string[]
              ) => {
                copyToClipboard(drillQuery, 'Drill Query');
              },
              nextRendererOptions: {
                onDrill: drillData => {
                  copyToClipboard(drillData.query, 'Drill Query');
                },
                tableConfig: {
                  enableDrill: true,
                },
              },
            })
            .then(html => {
              setProgressMessage('');
              setResults({
                ...currentResults,
                html,
              });
            })
            .catch(console.error);
        }
      }
    },
    [copyToClipboard, results]
  );

  useEffect(() => {
    window.addEventListener('message', onMessage);
    vscode.postMessage({type: QueryMessageType.AppReady});

    return () => window.removeEventListener('message', onMessage);
  }, [onMessage, vscode]);

  const getStats = (
    stats?: QueryRunStats,
    profilingUrl?: string,
    queryCostBytes?: number
  ) => {
    return (
      (stats
        ? `Compile Time: ${stats.compileTime.toLocaleString()}s, Run Time:
        ${stats.runTime.toLocaleString()}s, Total Time:
        ${stats.totalTime.toLocaleString()}s.`
        : '') +
      getQueryCostStats(queryCostBytes, !results.html) +
      getProfilingUrlLink(profilingUrl)
    );
  };

  const getQueryCostStats = (queryCostBytes?: number, isEstimate?: boolean) => {
    if (typeof queryCostBytes !== 'number') {
      return null;
    }

    if (queryCostBytes) {
      return `${isEstimate ? 'Will process' : 'Processed'} ${convertFromBytes(
        queryCostBytes
      )}`;
    } else {
      return 'From cache.';
    }
  };

  const getProfilingUrlLink = (profilingUrl?: string) => {
    return profilingUrl ? (
      <a className="profiling-url" href="${profilingUrl}">
        Query Profile Page
      </a>
    ) : null;
  };

  const onFieldClick = (field: Field) => {
    const type = fieldType(field);

    if (type !== 'query') {
      const {fieldPath} = field;
      fieldPath.shift(); // Remove source
      const path = fieldPath.map(quoteIfNecessary).join('.');
      copyToClipboard(path, 'Path');
    }
  };

  const onQueryClick = (query: NamedQuery | QueryField) => {
    if ('parentExplore' in query) {
      const status = QueryRunStatus.RunCommand;
      const command = 'malloy.runQuery';
      const arg1 = `run: ${query.parentExplore.name}->${query.name}`;
      const arg2 = `${query.parentExplore.name}->${query.name}`;
      const args = [arg1, arg2];
      vscode.postMessage({status, command, args});
    }
  };

  if (error) {
    return (
      <StyledContainer>
        <ErrorPanel message={error} />
      </StyledContainer>
    );
  } else if (progressMessage) {
    return <LabeledSpinner text={progressMessage} />;
  } else {
    return (
      <StyledContainer>
        <div className="result-controls-bar">
          <span className="result-label">MALLOY</span>
          <div className="result-controls-items">
            <ResultKindToggle
              availableKinds={availableKinds}
              resultKind={resultKind}
              setKind={(kind: ResultKind) => {
                setResultKind(kind);
              }}
            />
            {results.result && (
              <DownloadButton
                name={results.name}
                result={results.result!}
                canStream={results.canDownloadStream || false}
                onDownload={async (downloadOptions: QueryDownloadOptions) => {
                  vscode.postMessage({
                    status: QueryRunStatus.StartDownload,
                    downloadOptions,
                  });
                }}
                onCopy={async ({data}: QueryDownloadCopyData) => {
                  copyToClipboard(data, 'Results');
                }}
              />
            )}
          </div>
        </div>
        {(resultKind === ResultKind.HTML ||
          resultKind === ResultKind.PREVIEW) &&
        results.html ? (
          <div className="scroll result-container">
            <StyledDOMElement element={results.html} />
            <CopyButton
              onCopy={async () => {
                if (results.html) {
                  const copiedHtml = await getMalloyRenderHTML(results.html);
                  copyToClipboard(copiedHtml, 'HTML Results');
                }
              }}
            />
          </div>
        ) : null}
        {resultKind === ResultKind.JSON && results.json ? (
          <div className="scroll">
            <CodeContainer
              code={results.json!}
              language="json"
              darkMode={isDarkMode}
            ></CodeContainer>
            <CopyButton
              onCopy={() => copyToClipboard(results.json!, 'JSON Results')}
            />
          </div>
        ) : null}
        {resultKind === ResultKind.METADATA && results.metadata ? (
          <div className="scroll">
            <CodeContainer
              code={results.metadata!}
              language="json"
              darkMode={isDarkMode}
            ></CodeContainer>
            <CopyButton
              onCopy={() =>
                copyToClipboard(results.metadata!, 'Result Metadata')
              }
            />
          </div>
        ) : null}
        {resultKind === ResultKind.SCHEMA && results.schema ? (
          <div className="scroll">
            <SchemaRenderer
              explores={results.schema!}
              queries={[]}
              defaultShow={true}
              onFieldClick={onFieldClick}
              onQueryClick={onQueryClick}
            />
          </div>
        ) : null}
        {resultKind === ResultKind.SQL && results.sql ? (
          <div className="scroll">
            <div>
              <CodeContainer
                code={results.sql!}
                language="sql"
                darkMode={isDarkMode}
              ></CodeContainer>
              <CopyButton onCopy={() => copyToClipboard(results.sql!, 'SQL')} />
            </div>
          </div>
        ) : null}
        {results.stats || results.profilingUrl || results.queryCostBytes ? (
          <div className="stats">
            {getStats(
              results.stats,
              results.profilingUrl,
              results.queryCostBytes
            )}
          </div>
        ) : null}
        {results.warning && <div className="warning">${results.warning}</div>}
      </StyledContainer>
    );
  }
}

const CopyButton = styled(CopyButtonInner)`
  position: absolute;
  bottom: 35px;
  right: 25px;
  z-index: 1;
  display: none;
`;

const StyledContainer = styled.div`
  height: 100%;
  margin: 0;
  display: flex;
  flex-direction: column;

  .result-controls-bar {
    display: flex;
    border-bottom: 1px solid var(--vscode-panel-border);
    justify-content: space-between;
    align-items: center;
    color: var(--vscode-foreground);
    padding: 0 10px;
    user-select: none;
    height: 2em;
  }
  .result-label {
    font-weight: 500;
    font-size: 12px;
  }
  .result-controls-items {
    display: flex;
    align-items: center;
  }
  .result-container {
    padding: 10px;
    height: calc(100% - 20px);
  }
  .scroll {
    flex: 1;
    overflow: auto;

    &::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    &::-webkit-scrollbar-corner {
      background: var(--vscode-input-background, #3c3c3c);
    }
    &::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background, #79797966);
    }
    &::-webkit-scrollbar-thumb:hover {
      background: var(--vscode-scrollbarSlider-hoverBackground, #646464b3);
    }
    &::-webkit-scrollbar-thumb:active {
      background: var(--vscode-scrollbarSlider-activeBackground, #bfbfbf66);
    }
  }
  .stats {
    display: flex;
    color: var(--vscode-editorWidget-Foreground);
    background-color: var(--vscode-editorWidget-background);
    font-size: 12px;
    padding: 5px;
  }
  .profiling-url {
    padding-left: 10px;
    font-weight: bold;
    color: var(--vscode-editorWidget-Foreground);
  }
  .scroll:hover ${CopyButton} {
    display: block;
  }
  schema-renderer {
    margin: 10px;
  }
  .warning {
    color: var(--vscode-statusBarItem-warningForeground);
    background-color: var(--vscode-statusBarItem-warningBackground);
    font-size: 12px;
    padding: 5px;
  }
`;

const StyledDOMElement = styled(DOMElement)`
  height: 100%;
`;

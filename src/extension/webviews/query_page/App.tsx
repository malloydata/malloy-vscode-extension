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

import {Result} from '@malloydata/malloy';
import {HTMLView} from '@malloydata/render';
import React, {
  DOMElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import styled from 'styled-components';
import {
  QueryRunStatus,
  QueryRunStats,
  QueryMessageStatus,
  QueryMessageType,
} from '../../../common/message_types';
import {Spinner} from '../components';
import {ResultKind, ResultKindToggle} from './ResultKindToggle';
import Prism from 'prismjs';
import {usePopperTooltip} from 'react-popper-tooltip';
import {useQueryVSCodeContext} from './query_vscode_context';
import {DownloadButton} from './DownloadButton';
import {CopyButton} from './CopyButton';
import {Scroll} from '../components/Scroll';
import {PrismContainer} from '../components/PrismContainer';

enum Status {
  Ready = 'ready',
  Compiling = 'compiling',
  Running = 'running',
  Error = 'error',
  Displaying = 'displaying',
  Rendering = 'rendering',
  Done = 'done',
}

export const App: React.FC = () => {
  const [status, setStatus] = useState<Status>(Status.Ready);
  const [html, setHTML] = useState<HTMLElement>(document.createElement('span'));
  const [json, setJSON] = useState('');
  const [sql, setSQL] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [warning, setWarning] = useState<string | undefined>(undefined);
  const [resultKind, setResultKind] = useState<ResultKind>(ResultKind.HTML);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showOnlySQL, setShowOnlySQL] = useState(false);
  const [observer, setObserver] = useState<MutationObserver>();
  const [canDownload, setCanDownload] = useState(false);
  const [canDownloadStream, setCanDownloadStream] = useState(false);
  const [stats, setStats] = useState<string | undefined>(undefined);
  const tooltipId = useRef(0);
  const {setTooltipRef, setTriggerRef, getTooltipProps} = usePopperTooltip({
    visible: tooltipVisible,
    placement: 'top',
  });

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
    const listener = (event: MessageEvent<QueryMessageStatus>) => {
      const message = event.data;

      if (message.status === QueryRunStatus.Error) {
        setStatus(Status.Error);
        setError(message.error);
      } else {
        setError(undefined);
      }
      if (message.status === QueryRunStatus.Compiled && message.showSQLOnly) {
        setShowOnlySQL(true);
        setWarning(undefined);
        setStats(undefined);
        setStatus(Status.Done);
        setSQL(message.sql);
        setResultKind(ResultKind.SQL);
      } else if (message.status === QueryRunStatus.EstimatedCost) {
        setStats(getQueryCostStats(message.queryCostBytes, true));
      } else if (message.status === QueryRunStatus.Done) {
        const {resultJson, dataStyles, canDownloadStream} = message;
        setWarning(undefined);
        setShowOnlySQL(false);
        setStats(undefined);
        // TODO(web) Figure out some way to download current result set
        setCanDownload(canDownloadStream);
        setCanDownloadStream(canDownloadStream);
        setStatus(Status.Rendering);
        setTimeout(async () => {
          const result = Result.fromJSON(resultJson);
          // eslint-disable-next-line no-console
          const data = result.data;
          setJSON(JSON.stringify(data.toObject(), null, 2));
          setSQL(result.sql);
          if (message.stats) {
            setStats(getStats(message.stats, result.runStats?.queryCostBytes));
          }
          const rendered = await new HTMLView(document).render(result, {
            dataStyles,
            isDrillingEnabled: false,
            onDrill: (drillQuery, target) => {
              navigator.clipboard.writeText(drillQuery);
              setTriggerRef(target);
              setTooltipVisible(true);
              const currentTooltipId = ++tooltipId.current;
              setTimeout(() => {
                if (currentTooltipId === tooltipId.current) {
                  setTooltipVisible(false);
                }
              }, 1000);
            },
          });
          setStatus(Status.Displaying);
          setTimeout(() => {
            setHTML(rendered);
            if (data.rowCount < result.totalRows) {
              const rowCount = data.rowCount.toLocaleString();
              const totalRows = result.totalRows.toLocaleString();
              setWarning(
                `Row limit hit. Viewing ${rowCount} of ${totalRows} results.`
              );
            }
            setStatus(Status.Done);
          }, 0);
        }, 0);
      } else {
        setHTML(document.createElement('span'));
        setJSON('');
        setSQL('');
        setShowOnlySQL(false);
        switch (message.status) {
          case QueryRunStatus.Compiling:
            setStatus(Status.Compiling);
            break;
          case QueryRunStatus.Running:
            setStatus(Status.Running);
            break;
        }
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  });

  const copyToClipboard = useCallback(
    ({target}: MouseEvent) => {
      switch (resultKind) {
        case ResultKind.HTML:
          navigator.clipboard.writeText(getStyledHTML(html));
          break;
        case ResultKind.JSON:
          navigator.clipboard.writeText(json);
          break;
        case ResultKind.SQL:
          navigator.clipboard.writeText(sql);
          break;
      }
      setTriggerRef(target as HTMLElement);
      setTooltipVisible(true);
      const currentTooltipId = ++tooltipId.current;
      setTimeout(() => {
        if (currentTooltipId === tooltipId.current) {
          setTooltipVisible(false);
        }
      }, 1000);
    },
    [resultKind, html, json, sql]
  );

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
              {canDownload && (
                <DownloadButton
                  canStream={canDownloadStream}
                  onDownload={async downloadOptions => {
                    vscode.postMessage({
                      status: QueryRunStatus.StartDownload,
                      downloadOptions,
                    });
                  }}
                />
              )}
            </ResultControlsItems>
          )}
        </ResultControlsBar>
      )}
      {!error && resultKind === ResultKind.HTML && (
        <Scroll>
          <div style={{margin: '10px'}}>
            <CopyButton onClick={copyToClipboard} />
            <DOMElement element={html} />
          </div>
        </Scroll>
      )}
      {!error && resultKind === ResultKind.JSON && (
        <Scroll>
          <CopyButton onClick={copyToClipboard} />
          <PrismContainer darkMode={darkMode} style={{margin: '10px'}}>
            <div
              dangerouslySetInnerHTML={{
                __html: Prism.highlight(json, Prism.languages['json'], 'json'),
              }}
              style={{margin: '10px'}}
            />
          </PrismContainer>
        </Scroll>
      )}
      {!error && resultKind === ResultKind.SQL && (
        <Scroll>
          <CopyButton onClick={copyToClipboard} />
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
      {stats && <StatsBar>{stats}</StatsBar>}
      {tooltipVisible && (
        <Tooltip ref={setTooltipRef} {...getTooltipProps()}>
          Copied!
        </Tooltip>
      )}
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

function getStyledHTML(html: HTMLElement): string {
  const resolveStyles = getComputedStyle(html);
  const styles = /* html */ `<style>
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

function getStats(stats: QueryRunStats, queryCostBytes?: number): string {
  return `Compile Time: ${stats.compileTime.toLocaleString()}s, Run Time: ${stats.runTime.toLocaleString()}s, Total Time: ${stats.totalTime.toLocaleString()}s.${
    getQueryCostStats(queryCostBytes) ?? ''
  }`;
}

function getQueryCostStats(
  queryCostBytes?: number,
  isEstimate?: boolean
): string | undefined {
  return queryCostBytes
    ? ` ${isEstimate ? 'Will process' : 'Processed'} ${(
        queryCostBytes /
        1024 /
        1024
      ).toLocaleString()} MB.`
    : undefined;
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

const Tooltip = styled.div`
  background-color: #505050;
  color: white;
  border-radius: 5px;
  box-shadow: rgb(144 144 144) 0px 1px 5px 0px;
  padding: 5px;
`;

const Warning = styled.div`
  color: var(--vscode-statusBarItem-warningForeground);
  background-color: var(--vscode-statusBarItem-warningBackground);
  padding: 5px;
`;

const StatsBar = styled.div`
  background-color: #505050;
  color: white;
  box-shadow: rgb(144 144 144) 0px 1px 5px 0px;
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

const ResultControlsItems = styled.div`
  display: flex;
  align-items: center;
`;

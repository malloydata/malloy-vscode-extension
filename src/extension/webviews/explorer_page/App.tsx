/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Malloy from '@malloydata/malloy-interfaces';
import {VsCodeApi} from '../vscode_wrapper';
import {v4 as uuid} from 'uuid';
import {
  ComposerMessage,
  ComposerMessageType,
  ComposerPageMessage,
  ComposerPageMessageType,
  RunMalloyQueryStableResult,
} from '../../../common/types/message_types';
import {DrillData, Explorer, findSource} from './Explorer';
import {DocumentMetadata} from '../../../common/types/query_spec';
import {
  API,
  ModelDef,
  Result,
  SearchValueMapResult,
  malloyToQuery,
} from '@malloydata/malloy';
import {LabeledSpinner} from '../components/LabeledSpinner';
import {
  CodeEditorContext,
  QueryExecutionState,
  QueryResponse,
  SubmittedQuery,
} from '@malloydata/malloy-explorer';
import * as monaco from 'monaco-editor-core';

// @ts-expect-error no types
window.MonacoEnvironment = {
  getWorker(_workerId: string, _label: string) {
    return null; // Force work onto main thread for now
  },
};

// TODO(whscullin) fix when properly exported from @malloydata/malloy-explorer
export type SeverityLevel = 'INFO' | 'DEBUG' | 'WARN' | 'ERROR' | 'FATAL';

export type Message = {
  severity: SeverityLevel;
  title: string;
  description?: string;
  content?: string;
  customRenderer?: React.ReactNode;
};

export interface AppProps {
  vscode: VsCodeApi<ComposerPageMessage, void>;
}

interface QueryPromiseResolver {
  resolve: (result: RunMalloyQueryStableResult) => void;
  reject: (error: Error) => void;
}

const QueriesInFlight: Record<string, QueryPromiseResolver | undefined> = {};

export const App: React.FC<AppProps> = ({vscode}) => {
  const [documentMeta, setDocumentMeta] = useState<DocumentMetadata>();
  const [model, setModel] = useState<Malloy.ModelInfo>();
  const [modelDef, setModelDef] = useState<ModelDef>();
  const [sourceName, setSourceName] = useState<string>();
  const [viewName, setViewName] = useState<string>();
  const [initialQuery, setInitialQuery] = useState<Malloy.Query>();
  const [topValues, setTopValues] = useState<SearchValueMapResult[]>();
  const [response, setResponse] = useState<QueryResponse>();
  const [query, setQuery] = useState<Malloy.Query | string>();
  const [executionState, setExecutionState] =
    useState<QueryExecutionState>('finished');
  const [queryResolutionStartMillis, setQueryResolutionStartMillis] = useState<
    number | null
  >(null);
  const modelUri = useMemo(
    () => (documentMeta ? new URL(documentMeta.uri) : undefined),
    [documentMeta]
  );

  const source =
    model && sourceName ? findSource(model, sourceName) : undefined;

  const submittedQuery = useMemo(() => {
    let sq: SubmittedQuery | undefined;
    if (query && queryResolutionStartMillis != null) {
      sq = {
        query,
        executionState,
        queryResolutionStartMillis,
        onCancel: () => {}, // TODO: add compilation cancellation
        response,
      };
    }
    return sq;
  }, [executionState, query, queryResolutionStartMillis, response]);

  useEffect(() => {
    const messageHandler = ({data}: MessageEvent<ComposerMessage>) => {
      const {type} = data;
      switch (type) {
        case ComposerMessageType.NewModelInfo:
          {
            const {
              documentMeta,
              model,
              modelDef,
              sourceName,
              viewName,
              initialQuery,
            } = data;
            console.info(JSON.stringify(documentMeta, null, 2));
            setDocumentMeta(documentMeta);
            setModel(model);
            setModelDef(modelDef);
            setSourceName(sourceName);
            setViewName(viewName);
            setInitialQuery(initialQuery);
          }
          break;
        case ComposerMessageType.ResultSuccess:
          {
            const {id, result} = data;
            if (QueriesInFlight[id]) {
              const stableResult: RunMalloyQueryStableResult = {
                ...result,
                result: API.util.wrapResult(Result.fromJSON(result.resultJson)),
              };
              QueriesInFlight[id]?.resolve(stableResult);
              delete QueriesInFlight[id];
            }
          }
          break;
        case ComposerMessageType.StableResultSuccess:
          {
            const {id, result} = data;
            if (QueriesInFlight[id]) {
              QueriesInFlight[id]?.resolve(result);
              delete QueriesInFlight[id];
            }
          }
          break;
        case ComposerMessageType.ResultError:
          {
            const {id, error} = data;
            if (QueriesInFlight[id]) {
              QueriesInFlight[id]?.reject(new Error(error));
              delete QueriesInFlight[id];
            }
          }
          break;
        case ComposerMessageType.SearchIndex:
          {
            const result = Result.fromJSON(data.result.resultJson);
            setTopValues(
              result._queryResult.result as unknown as SearchValueMapResult[]
            );
          }
          break;
      }
    };
    window.addEventListener('message', messageHandler);
    vscode.postMessage({type: ComposerPageMessageType.Ready});

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, [vscode]);

  const runQuery = useCallback(
    async (
      source: Malloy.SourceInfo,
      query: Malloy.Query | string
    ): Promise<void> => {
      if (!source) {
        throw new Error('Undefined source');
      }
      const id = uuid();
      setQuery(query);
      setQueryResolutionStartMillis(Date.now());
      setExecutionState('running');
      const promise = new Promise<RunMalloyQueryStableResult>(
        (resolve, reject) => {
          QueriesInFlight[id] = {
            resolve,
            reject,
          };
        }
      );
      if (typeof query === 'string') {
        vscode.postMessage({
          type: ComposerPageMessageType.RunQuery,
          id,
          query,
          queryName: 'query',
        });
      } else {
        vscode.postMessage({
          type: ComposerPageMessageType.RunStableQuery,
          id,
          query,
          source,
        });
      }
      try {
        const {result} = await promise;
        setResponse({result});
      } catch (error) {
        console.info(error);
        const messages: Message[] = [
          {
            severity: 'ERROR',
            title: 'Error',
            content: error instanceof Error ? error.message : `${error}`,
          },
        ];
        setResponse({messages});
      }
      setExecutionState('finished');
    },
    [vscode]
  );

  const refreshModel = React.useCallback(
    (source: Malloy.SourceInfo, query: Malloy.Query | string) => {
      if (typeof query === 'string') {
        vscode.postMessage({
          type: ComposerPageMessageType.RefreshModel,
          query,
        });
      } else {
        vscode.postMessage({
          type: ComposerPageMessageType.RefreshStableModel,
          source,
          query,
        });
      }
    },
    [vscode]
  );

  const onDrill = React.useCallback(
    ({stableQuery, stableDrillClauses}: DrillData) =>
      vscode.postMessage({
        type: ComposerPageMessageType.OnDrill,
        stableQuery,
        stableDrillClauses,
      }),
    [vscode]
  );

  const onDownload = React.useCallback(
    ({
      source,
      submittedQuery,
      name,
      format,
    }: {
      source: Malloy.SourceInfo;
      submittedQuery: SubmittedQuery;
      name: string;
      format: 'json' | 'csv';
    }) =>
      vscode.postMessage({
        type: ComposerPageMessageType.OnDownload,
        source: source,
        query: submittedQuery.query,
        result: submittedQuery.response?.result,
        name,
        format,
      }),
    [vscode]
  );

  if (documentMeta && model && sourceName) {
    return (
      <div style={{height: '100%'}}>
        <CodeEditorContext.Provider
          value={{monaco, modelDef, malloyToQuery, modelUri}}
        >
          <Explorer
            source={source}
            runQuery={runQuery}
            runRawQuery={runQuery}
            topValues={topValues}
            submittedQuery={submittedQuery}
            viewName={viewName}
            initialQuery={initialQuery}
            refreshModel={refreshModel}
            onDrill={onDrill}
            onDownload={onDownload}
          />
        </CodeEditorContext.Provider>
      </div>
    );
  } else {
    return <LabeledSpinner text="Loading Data" />;
  }
};

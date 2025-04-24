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
import {Explorer, findSource} from './Explorer';
import {DocumentMetadata} from '../../../common/types/query_spec';
import {Result, SearchValueMapResult} from '@malloydata/malloy';
import {LabeledSpinner} from '../components/LabeledSpinner';
import {
  QueryExecutionState,
  QueryResponse,
  SubmittedQuery,
} from '@malloydata/malloy-explorer';
import {ErrorPanel} from '../components/ErrorPanel';

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
  const [sourceName, setSourceName] = useState<string>();
  const [viewName, setViewName] = useState<string>();
  const [topValues, setTopValues] = useState<SearchValueMapResult[]>();
  const [response, setResponse] = useState<QueryResponse>();
  const [query, setQuery] = useState<Malloy.Query>();
  const [executionState, setExecutionState] =
    useState<QueryExecutionState>('finished');
  const [queryResolutionStartMillis, setQueryResolutionStartMillis] = useState<
    number | null
  >(null);
  const [error, setError] = useState('');

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
            const {documentMeta, model, sourceName, viewName} = data;
            console.info(JSON.stringify(documentMeta, null, 2));
            setDocumentMeta(documentMeta);
            setModel(model);
            setSourceName(sourceName);
            setViewName(viewName);
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
    async (source: Malloy.SourceInfo, query: Malloy.Query): Promise<void> => {
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
      vscode.postMessage({
        type: ComposerPageMessageType.RunStableQuery,
        id,
        query,
        source,
      });
      try {
        const {result} = await promise;
        setResponse({result});
        setError('');
      } catch (error) {
        setError(error instanceof Error ? error.message : `${error}`);
      }
      setExecutionState('finished');
    },
    [vscode]
  );

  const refreshModel = React.useCallback(
    (source: Malloy.SourceInfo, query: Malloy.Query) =>
      vscode.postMessage({
        type: ComposerPageMessageType.RefreshStableModel,
        source,
        query,
      }),
    [vscode]
  );

  if (error) {
    return <ErrorPanel message={error} />;
  }

  if (documentMeta && model && sourceName) {
    return (
      <div style={{height: '100%'}}>
        <Explorer
          source={source}
          runQuery={runQuery}
          topValues={topValues}
          submittedQuery={submittedQuery}
          viewName={viewName}
          refreshModel={refreshModel}
        />
      </div>
    );
  } else {
    return <LabeledSpinner text="Loading Data" />;
  }
};

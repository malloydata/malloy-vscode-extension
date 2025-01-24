/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {useCallback, useEffect, useState} from 'react';
import {
  ExploreQueryEditor,
  useQueryBuilder,
  useRunQuery,
  RunQuery,
} from '@malloydata/query-composer';
import {
  ModelDef,
  Result,
  SearchValueMapResult,
  SourceDef,
} from '@malloydata/malloy';

import {DocumentMetadata} from '../../../common/types/query_spec';
import {
  QueryRunStats,
  RunMalloyQueryResult,
} from '../../../common/types/message_types';
import styled from 'styled-components';
import {convertFromBytes} from '../../../common/convert_to_bytes';

export interface ComposerProps {
  documentMeta: DocumentMetadata;
  modelDef: ModelDef;
  sourceName: string;
  viewName?: string;
  runQuery: (
    query: string,
    queryName: string | undefined
  ) => Promise<RunMalloyQueryResult>;
  refreshModel: (query: string) => void;
  topValues: SearchValueMapResult[] | undefined;
}

const nullUpdateQueryInUrl = () => {};

export const Composer: React.FC<ComposerProps> = ({
  documentMeta,
  modelDef,
  sourceName,
  viewName,
  runQuery: runQueryImp,
  refreshModel,
  topValues,
}) => {
  const [error, setError] = useState<Error>();
  const {
    error: queryError,
    queryModifiers,
    querySummary,
    queryWriter,
  } = useQueryBuilder(
    modelDef,
    sourceName,
    documentMeta.uri,
    nullUpdateQueryInUrl
  );

  const [stats, setStats] = useState<QueryRunStats>();
  const [profilingUrl, setProfilingUrl] = useState<string>();
  const [queryCostBytes, setQueryCostBytes] = useState<number>();

  const runQueryWrapper = useCallback<RunQuery>(
    async (
      query: string,
      _modelDef: ModelDef,
      _modelPath: string,
      queryName: string | undefined
    ): Promise<Result> => {
      setStats(undefined);
      setProfilingUrl(undefined);
      setQueryCostBytes(undefined);
      const {profilingUrl, resultJson, stats} = await runQueryImp(
        query,
        queryName
      );
      const result = Result.fromJSON(resultJson);
      setStats(stats);
      setProfilingUrl(profilingUrl);
      setQueryCostBytes(result.runStats?.queryCostBytes);
      return result;
    },
    [runQueryImp]
  );

  const {
    isRunning,
    error: runtimeError,
    result,
    runQuery,
  } = useRunQuery(modelDef, documentMeta.uri, runQueryWrapper);

  useEffect(() => {
    if (queryError) {
      setError(queryError);
    } else if (runtimeError) {
      setError(runtimeError);
    } else {
      setError(undefined);
    }
  }, [queryError, runtimeError]);

  const source = modelDef.contents[sourceName] as SourceDef;

  useEffect(() => {
    if (viewName) {
      queryModifiers.loadQuery(viewName);
    }
  }, [queryModifiers, viewName]);

  const query = queryWriter.getQueryStringForNotebook();

  return (
    <Outer>
      <Editor>
        <ExploreQueryEditor
          model={modelDef}
          modelPath={documentMeta.fileName}
          source={source}
          queryModifiers={queryModifiers}
          topValues={topValues}
          querySummary={querySummary}
          queryWriter={queryWriter}
          result={result || error}
          isRunning={isRunning}
          runQuery={runQuery}
          refreshModel={() => refreshModel(query)}
        />
      </Editor>
      <Stats>{getStats(stats, profilingUrl, queryCostBytes)}</Stats>
    </Outer>
  );
};

function getStats(
  stats?: QueryRunStats,
  profilingUrl?: string,
  queryCostBytes?: number
) {
  return (
    <span>
      {stats
        ? `Compile Time: ${stats.compileTime.toLocaleString()}s, Run Time:
      ${stats.runTime.toLocaleString()}s, Total Time:
      ${stats.totalTime.toLocaleString()}s.`
        : ''}
      {getQueryCostStats(queryCostBytes) ?? ''}
      {getProfilingUrlLink(profilingUrl)}
    </span>
  );
}

function getQueryCostStats(queryCostBytes?: number, isEstimate?: boolean) {
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
}

function getProfilingUrlLink(profilingUrl?: string) {
  return profilingUrl ? <a href="${profilingUrl}">Query Profile Page</a> : null;
}

const Outer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Editor = styled.div`
  display: flex;
  flex-grow: 1;
  overflow: automatic;
  height: 100%;
`;

const Stats = styled.div`
  display: flex;
  color: var(--vscode-editorWidget-Foreground);
  background-color: var(--vscode-editorWidget-background);
  font-size: 12px;
  padding: 5px;
  flex-grow: 0;
`;

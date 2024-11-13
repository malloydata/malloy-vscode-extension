/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {useEffect, useState} from 'react';
import {
  ExploreQueryEditor,
  useQueryBuilder,
  useRunQuery,
  RunQuery,
} from '@malloydata/query-composer';
import {ModelDef, SearchValueMapResult, SourceDef} from '@malloydata/malloy';

import {DocumentMetadata} from '../../../common/types/query_spec';

export interface ComposerProps {
  documentMeta: DocumentMetadata;
  modelDef: ModelDef;
  sourceName: string;
  viewName?: string;
  runQuery: RunQuery;
  topValues: SearchValueMapResult[] | undefined;
}

const nullUpdateQueryInUrl = () => {};

export const Composer: React.FC<ComposerProps> = ({
  documentMeta,
  modelDef,
  sourceName,
  viewName,
  runQuery: runQueryImp,
  topValues,
}) => {
  const [error, setError] = useState<Error>();
  const {
    error: queryError,
    queryMalloy,
    queryName,
    queryModifiers,
    querySummary,
  } = useQueryBuilder(
    modelDef,
    sourceName,
    documentMeta.uri,
    nullUpdateQueryInUrl
  );

  const {
    isRunning,
    error: runtimeError,
    result,
    runQuery,
  } = useRunQuery(modelDef, documentMeta.uri, runQueryImp);

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

  return (
    <>
      <ExploreQueryEditor
        model={modelDef}
        modelPath={documentMeta.fileName}
        source={source}
        queryModifiers={queryModifiers}
        topValues={topValues}
        queryName={queryName}
        querySummary={querySummary}
        queryMalloy={queryMalloy}
        result={result || error}
        isRunning={isRunning}
        runQuery={runQuery}
      />
    </>
  );
};

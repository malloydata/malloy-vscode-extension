/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  ExploreQueryEditor,
  useQueryBuilder,
  useRunQuery,
  RunQuery,
} from '@malloydata/query-composer';
import {ModelDef, SearchValueMapResult, SourceDef} from '@malloydata/malloy';

import {DocumentMetadata} from '../../../common/types/query_spec';
import {ErrorMessage} from './Error';

export interface ComposerProps {
  documentMeta: DocumentMetadata;
  modelDef: ModelDef;
  sourceName: string;
  runQuery: RunQuery;
}

const topValues: SearchValueMapResult[] = [];

const nullUpdateQueryInUrl = () => {};

export const Composer: React.FC<ComposerProps> = ({
  documentMeta,
  modelDef,
  sourceName,
  runQuery: runQueryImp,
}) => {
  const {queryMalloy, queryName, queryModifiers, querySummary} =
    useQueryBuilder(
      modelDef,
      sourceName,
      documentMeta.uri,
      nullUpdateQueryInUrl
    );

  const {isRunning, error, result, runQuery} = useRunQuery(
    modelDef,
    documentMeta.uri,
    runQueryImp
  );

  const source = modelDef.contents[sourceName] as SourceDef;

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
        result={result}
        isRunning={isRunning}
        runQuery={runQuery}
      />
      <ErrorMessage error={error?.message} />
    </>
  );
};

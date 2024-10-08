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
  RunQuery,
} from '@malloydata/query-composer';
import {ModelDef, SearchValueMapResult, SourceDef} from '@malloydata/malloy';

import {DocumentMetadata} from '../../../common/types/query_spec';

export interface ComposerProps {
  documentMeta: DocumentMetadata;
  modelDef: ModelDef;
  sourceName: string;
  runQuery: RunQuery;
}

const topValues: SearchValueMapResult[] = [];

const nullUpdateQueryInUrl = () => {};
const emptyDataStyles = {}; // dataStyles

export const Composer: React.FC<ComposerProps> = ({
  documentMeta,
  modelDef,
  sourceName,
  runQuery: runQueryExternal,
}) => {
  const {
    dirty,
    queryMalloy,
    queryName,
    isRunning,
    queryModifiers,
    querySummary,
    dataStyles,
    result,
    registerNewSource,
    runQuery,
    canUndo,
    undo,
    isQueryEmpty,
    canQueryRun,
  } = useQueryBuilder(
    modelDef,
    documentMeta.uri,
    nullUpdateQueryInUrl,
    emptyDataStyles,
    runQueryExternal
  );

  const source = modelDef.contents[sourceName] as SourceDef;

  React.useEffect(() => {
    registerNewSource(source);
  }, [source]);

  return (
    <ExploreQueryEditor
      dirty={dirty}
      model={modelDef}
      modelPath={documentMeta.fileName}
      source={source}
      queryModifiers={queryModifiers}
      topValues={topValues}
      queryName={queryName}
      querySummary={querySummary}
      queryMalloy={queryMalloy}
      dataStyles={dataStyles}
      result={result}
      isRunning={isRunning}
      runQuery={runQuery}
      canUndo={canUndo}
      undo={undo}
      isQueryEmpty={isQueryEmpty}
      canQueryRun={canQueryRun}
    />
  );
};

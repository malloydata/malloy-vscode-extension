/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {useEffect, useState} from 'react';
import * as Malloy from '@malloydata/malloy-interfaces';
import {
  MalloyExplorerProvider,
  QueryPanel,
  ResizableCollapsiblePanel,
  ResultPanel,
  SourcePanel,
  SubmittedQuery,
} from '@malloydata/malloy-explorer';

import type {SearchValueMapResult} from '@malloydata/malloy';
import {ErrorPanel} from '../components/ErrorPanel';

export interface DrillData {
  stableQuery: Malloy.Query | undefined;
  stableDrillClauses: Malloy.DrillOperation[] | undefined;
}

export function findSource(
  model: Malloy.ModelInfo,
  name: string
): Malloy.SourceInfo | undefined {
  return model.entries.find(
    entry => entry.name === name && entry.kind === 'source'
  );
}

export function findView(
  source: Malloy.SourceInfo,
  name: string
): Malloy.FieldInfo | undefined {
  return source.schema.fields.find(
    entry => entry.name === name && entry.kind === 'view'
  );
}

export interface ExplorerProps {
  source: Malloy.SourceInfo | undefined;
  runQuery: (source: Malloy.SourceInfo, query: Malloy.Query) => Promise<void>;
  submittedQuery: SubmittedQuery | undefined;
  topValues: SearchValueMapResult[] | undefined;
  viewName?: string;
  initialQuery?: Malloy.Query;
  refreshModel: (source: Malloy.SourceInfo, query: Malloy.Query) => void;
  onDrill?: (props: DrillData) => void;
}

export const Explorer: React.FC<ExplorerProps> = ({
  source,
  runQuery,
  submittedQuery,
  topValues,
  viewName,
  initialQuery,
  refreshModel,
  onDrill,
}) => {
  const [query, setQuery] = useState<Malloy.Query>();
  const [focusedNestViewPath, setFocusedNestViewPath] = useState<string[]>([]);

  useEffect(() => {
    if (source && viewName) {
      const view = findView(source, viewName);
      if (view) {
        const query: Malloy.Query = {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: source.name,
            },
            view: {
              kind: 'view_reference',
              name: viewName,
            },
          },
        };
        setQuery(query);
      }
    }
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery, source, viewName]);

  if (!source) {
    return <ErrorPanel message="Invalid source" />;
  }

  return (
    <MalloyExplorerProvider
      source={source}
      onQueryChange={setQuery}
      query={query}
      topValues={topValues}
      onFocusedNestViewPathChange={setFocusedNestViewPath}
      focusedNestViewPath={focusedNestViewPath}
      onDrill={onDrill}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          <ResizableCollapsiblePanel
            isInitiallyExpanded={true}
            initialWidth={280}
            minWidth={180}
            icon="database"
            title={source.name}
          >
            <SourcePanel
              onRefresh={() => {
                if (source && query) refreshModel(source, query);
              }}
            />
          </ResizableCollapsiblePanel>
          <ResizableCollapsiblePanel
            isInitiallyExpanded={true}
            initialWidth={360}
            minWidth={280}
            icon="filterSliders"
            title="Query"
          >
            <QueryPanel runQuery={runQuery} />
          </ResizableCollapsiblePanel>
          <div style={{height: '100%', flex: '1 1 auto'}}>
            <ResultPanel
              source={source}
              draftQuery={query}
              setDraftQuery={setQuery}
              submittedQuery={submittedQuery}
            />
          </div>
        </div>
      </div>
    </MalloyExplorerProvider>
  );
};

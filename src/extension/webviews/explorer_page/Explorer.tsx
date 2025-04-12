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
  ExplorerPanelsContext,
  MalloyExplorerProvider,
  QueryPanel,
  ResizeBar,
  ResultPanel,
  SourcePanel,
  SubmittedQuery,
} from '@malloydata/malloy-explorer';

import type {SearchValueMapResult} from '@malloydata/malloy';

export interface ExplorerProps {
  source: Malloy.SourceInfo | undefined;
  runQuery: (source: Malloy.SourceInfo, query: Malloy.Query) => Promise<void>;
  submittedQuery: SubmittedQuery | undefined;
  topValues: SearchValueMapResult[] | undefined;
  viewName?: string;
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

export const Explorer: React.FC<ExplorerProps> = ({
  source,
  runQuery,
  submittedQuery,
  topValues,
  viewName,
}) => {
  const [query, setQuery] = useState<Malloy.Query>();
  const [isSourcePanelOpen, setIsSourcePanelOpen] = useState(true);
  const [sourcePanelWidth, setSourcePanelWidth] = useState(280);
  const [queryPanelWidth, setQueryPanelWidth] = useState(360);

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
  }, [source, viewName]);

  if (!source) {
    return <div>Invalid source name</div>;
  }

  return (
    <MalloyExplorerProvider
      source={source}
      setQuery={setQuery}
      query={query}
      topValues={topValues}
    >
      <ExplorerPanelsContext.Provider
        value={{
          isSourcePanelOpen,
          setIsSourcePanelOpen,
        }}
      >
        <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
          <div
            style={{
              display: 'flex',
              height: '100%',
              overflowY: 'auto',
            }}
          >
            {isSourcePanelOpen && (
              <div
                style={{
                  width: sourcePanelWidth,
                  position: 'relative',
                  height: '100%',
                  flex: '0 0 auto',
                }}
              >
                <SourcePanel
                  source={source}
                  query={query}
                  setQuery={setQuery}
                />
                <ResizeBar
                  minWidth={180}
                  width={sourcePanelWidth}
                  onWidthChange={setSourcePanelWidth}
                />
              </div>
            )}

            <div
              style={{
                width: queryPanelWidth,
                position: 'relative',
                height: '100%',
                flex: '0 0 auto',
              }}
            >
              <QueryPanel
                source={source}
                query={query}
                setQuery={setQuery}
                runQuery={runQuery}
                showSource={false}
              />
              <ResizeBar
                minWidth={230}
                width={queryPanelWidth}
                onWidthChange={setQueryPanelWidth}
              />
            </div>
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
      </ExplorerPanelsContext.Provider>
    </MalloyExplorerProvider>
  );
};

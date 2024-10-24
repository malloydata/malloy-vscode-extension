/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {VsCodeApi} from '../vscode_wrapper';
import {v4 as uuid} from 'uuid';
import {
  ComposerMessage,
  ComposerMessageType,
  ComposerPageMessage,
  ComposerPageMessageType,
} from '../../../common/types/message_types';
import {Composer} from './Composer';
import {DocumentMetadata} from '../../../common/types/query_spec';
import {ModelDef, Result, SearchValueMapResult} from '@malloydata/malloy';
import {RunQuery} from '@malloydata/query-composer';

export interface AppProps {
  vscode: VsCodeApi<ComposerPageMessage, void>;
}

interface QueryPromiseResolver {
  resolve: (result: Result) => void;
  reject: (error: Error) => void;
}

const QueriesInFlight: Record<string, QueryPromiseResolver | undefined> = {};

export const App: React.FC<AppProps> = ({vscode}) => {
  const [documentMeta, setDocumentMeta] = React.useState<DocumentMetadata>();
  const [modelDef, setModelDef] = React.useState<ModelDef>();
  const [sourceName, setSourceName] = React.useState<string>();
  const [viewName, setViewName] = React.useState<string>();
  const [topValues, setTopValues] = React.useState<SearchValueMapResult[]>();

  React.useEffect(() => {
    const messageHandler = ({data}: MessageEvent<ComposerMessage>) => {
      const {type} = data;
      switch (type) {
        case ComposerMessageType.NewModel:
          {
            const {documentMeta, modelDef, sourceName, viewName} = data;
            console.info(JSON.stringify(documentMeta, null, 2));
            setDocumentMeta(documentMeta);
            setModelDef(modelDef);
            setSourceName(sourceName);
            setViewName(viewName);
          }
          break;
        case ComposerMessageType.ResultSuccess:
          {
            const {id, result} = data;
            if (QueriesInFlight[id]) {
              QueriesInFlight[id]?.resolve(Result.fromJSON(result));
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
            const result = Result.fromJSON(data.result);
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

  const runQuery = React.useCallback<RunQuery>(
    (query: string, model: ModelDef, modelPath: string, queryName: string) => {
      const id = uuid();
      const promise = new Promise<Result>((resolve, reject) => {
        QueriesInFlight[id] = {
          resolve,
          reject,
        };
      });
      vscode.postMessage({
        type: ComposerPageMessageType.RunQuery,
        id,
        query,
        queryName,
      });
      return promise;
    },
    [vscode]
  );

  if (documentMeta && modelDef && sourceName) {
    return (
      <div style={{height: '100%'}}>
        <Composer
          documentMeta={documentMeta}
          modelDef={modelDef}
          sourceName={sourceName}
          viewName={viewName}
          runQuery={runQuery}
          topValues={topValues}
        />
      </div>
    );
  } else {
    return <h1>Loading</h1>;
  }
};

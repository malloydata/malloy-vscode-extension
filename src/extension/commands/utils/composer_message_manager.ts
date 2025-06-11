/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import * as vscode from 'vscode';
import * as Malloy from '@malloydata/malloy-interfaces';
import * as QueryBuilder from '@malloydata/malloy-query-builder';
import {v1 as uuid} from 'uuid';
import {WebviewMessageManager} from '../../webview_message_manager';
import {
  ComposerMessage,
  ComposerMessageType,
  ComposerPageMessage,
  ComposerPageMessageRefreshModel,
  ComposerPageMessageRefreshStableModel,
  ComposerPageMessageRunQuery,
  ComposerPageMessageRunStableQuery,
  ComposerPageMessageType,
} from '../../../common/types/message_types';
import {DocumentMetadata, QuerySpec} from '../../../common/types/query_spec';
import {API, ModelDef, modelDefToModelInfo, Result} from '@malloydata/malloy';
import {runMalloyQuery} from './run_query_utils';
import {WorkerConnection} from '../../worker_connection';
import {getSourceDef} from '../../../common/schema';
import {indexCache} from './index_cache';

export class ComposerMessageManager
  extends WebviewMessageManager<ComposerMessage, ComposerPageMessage>
  implements vscode.Disposable
{
  constructor(
    private worker: WorkerConnection,
    composerPanel: vscode.WebviewPanel,
    private documentMeta: DocumentMetadata,
    private sourceName?: string,
    private viewName?: string,
    private initialQuery?: Malloy.Query
  ) {
    super(composerPanel);
    this.onReceiveMessage(async message => {
      switch (message.type) {
        case ComposerPageMessageType.RunQuery:
          await this.runQuery(message);
          break;
        case ComposerPageMessageType.RunStableQuery:
          await this.runStableQuery(message);
          break;
        case ComposerPageMessageType.RefreshModel:
          await this.refreshModel(message);
          break;
        case ComposerPageMessageType.RefreshStableModel:
          await this.refreshStableModel(message);
          break;
        case ComposerPageMessageType.OnDrill: {
          await vscode.commands.executeCommand(
            'malloy.openComposer',
            this.sourceName,
            undefined,
            message.stableQuery,
            this.documentMeta
          );
        }
      }
    });
  }

  async runQuery(message: ComposerPageMessageRunQuery) {
    {
      const {id, query, queryName} = message;
      try {
        const result = await this.runQueryWithProgress(id, queryName, query);
        if (result) {
          this.postMessage({
            type: ComposerMessageType.ResultSuccess,
            id,
            result,
          });
        } else {
          this.postMessage({
            type: ComposerMessageType.ResultError,
            id,
            error: 'No results',
          });
        }
      } catch (error) {
        this.postMessage({
          type: ComposerMessageType.ResultError,
          id,
          error: error instanceof Error ? error.message : `${error}`,
        });
      }
    }
  }

  async runStableQuery(message: ComposerPageMessageRunStableQuery) {
    {
      const {id, source, query} = message;
      try {
        const qb = new QueryBuilder.ASTQuery({source, query});
        const runQueryResult = await this.runQueryWithProgress(
          id,
          'Explorer',
          qb.toMalloy()
        );
        if (runQueryResult) {
          const {stats, resultJson, profilingUrl} = runQueryResult;
          const legacyResult = Result.fromJSON(resultJson);
          const result = API.util.wrapResult(legacyResult);
          // TODO - remove once wrapResult is fixed
          result.sql = legacyResult.sql;
          this.postMessage({
            type: ComposerMessageType.StableResultSuccess,
            id,
            result: {
              stats,
              result,
              profilingUrl,
            },
          });
        } else {
          this.postMessage({
            type: ComposerMessageType.ResultError,
            id,
            error: 'No results',
          });
        }
      } catch (error) {
        this.postMessage({
          type: ComposerMessageType.ResultError,
          id,
          error: error instanceof Error ? error.message : `${error}`,
        });
      }
    }
  }

  async initializeIndex(modelDef: ModelDef, sourceName: string): Promise<void> {
    const cacheKey = this.documentMeta.fileName + ':' + sourceName;
    const cachedResult = indexCache.get(cacheKey);
    if (cachedResult) {
      this.postMessage({
        type: ComposerMessageType.SearchIndex,
        result: cachedResult,
      });
      return;
    }
    const sourceDef = getSourceDef(modelDef, sourceName);
    const indexQuery = sourceDef.fields.find(
      ({name, as}) => (as || name) === 'search_index'
    );
    const limit =
      vscode.workspace
        .getConfiguration('malloy')
        .get<number>('indexSearchLimit') ?? 100;

    if (indexQuery) {
      const searchMapMalloy = `
        run: ${sourceName}
          -> ${indexQuery.as || indexQuery.name}
          -> {
            where: fieldType = 'string'
            group_by: fieldName
            aggregate: cardinality is count(fieldValue)
            nest: values is {
              select: fieldValue, weight
              order_by: weight desc
              limit: ${limit}
            }
            limit: 1000
          }
      `;
      const result = await this.runQueryWithProgress(
        uuid(),
        `Search index for ${sourceName}`,
        searchMapMalloy
      );
      if (result) {
        indexCache.set(cacheKey, result);
        this.postMessage({
          type: ComposerMessageType.SearchIndex,
          result,
        });
      }
    }
  }

  async runQueryWithProgress(id: string, queryName: string, query: string) {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: queryName,
        cancellable: true,
      },
      async (progress, cancellationToken) => {
        const querySpec: QuerySpec = {
          type: 'string',
          text: query,
          documentMeta: this.documentMeta,
        };
        const result = await runMalloyQuery(
          this.worker,
          querySpec,
          id,
          queryName,
          {withWebview: false},
          cancellationToken,
          progress
        );
        return result;
      }
    );
  }

  async refreshModel({query}: ComposerPageMessageRefreshModel): Promise<void> {
    try {
      const modelDef = await this.worker.sendRequest('malloy/compile', {
        documentMeta: this.documentMeta,
        query,
      });
      const sourceName = this.sourceName ?? Object.keys(modelDef.contents)[0];
      const model = modelDefToModelInfo(modelDef);
      this.postMessage({
        type: ComposerMessageType.NewModelInfo,
        documentMeta: this.documentMeta,
        model,
        sourceName,
      });
      void vscode.window.showInformationMessage('Model refreshed');
      indexCache.invalidate(this.documentMeta.fileName + ':' + sourceName);
      await this.initializeIndex(modelDef, sourceName);
    } catch (error) {
      const message = `${error instanceof Error ? error.message : error}`;
      const match = message.match(/FILE: internal:\/\/internal\.malloy\n(.*)/m);
      let errorMessage: string;
      if (match) {
        errorMessage = `Query is incompatible:\n${match[1]}`;
      } else {
        errorMessage = 'Model does not compile';
      }
      void vscode.window.showErrorMessage(
        `Could not refresh model: ${errorMessage}`
      );
    }
  }

  async refreshStableModel({
    source,
    query,
  }: ComposerPageMessageRefreshStableModel): Promise<void> {
    const qb = new QueryBuilder.ASTQuery({source, query});
    return this.refreshModel({
      type: ComposerPageMessageType.RefreshModel,
      query: qb.toMalloy(),
    });
  }

  async newModel(): Promise<void> {
    const modelDef = await this.worker.sendRequest('malloy/compile', {
      documentMeta: this.documentMeta,
    });

    const sourceName = this.sourceName ?? Object.keys(modelDef.contents)[0];
    const model = modelDefToModelInfo(modelDef);
    this.postMessage({
      type: ComposerMessageType.NewModelInfo,
      documentMeta: this.documentMeta,
      model,
      sourceName,
      viewName: this.viewName,
      initialQuery: this.initialQuery,
    });

    void this.initializeIndex(modelDef, sourceName);
  }

  dispose() {}
}

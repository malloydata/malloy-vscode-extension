/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import * as vscode from 'vscode';
import {v1 as uuid} from 'uuid';
import {WebviewMessageManager} from '../../webview_message_manager';
import {
  ComposerMessage,
  ComposerMessageType,
  ComposerPageMessage,
  ComposerPageMessageRefreshModel,
  ComposerPageMessageRunQuery,
  ComposerPageMessageType,
} from '../../../common/types/message_types';
import {DocumentMetadata, QuerySpec} from '../../../common/types/query_spec';
import {ModelDef, SearchValueMapResult} from '@malloydata/malloy';
import {runMalloyQuery} from './run_query_utils';
import {WorkerConnection} from '../../worker_connection';
import {getSourceDef} from '../../../common/schema';

export class ComposerMessageManager
  extends WebviewMessageManager<ComposerMessage, ComposerPageMessage>
  implements vscode.Disposable
{
  constructor(
    private worker: WorkerConnection,
    composerPanel: vscode.WebviewPanel,
    private documentMeta: DocumentMetadata,
    private modelDef: ModelDef,
    private sourceName: string,
    viewName?: string
  ) {
    super(composerPanel);

    this.postMessage({
      type: ComposerMessageType.NewModel,
      documentMeta,
      modelDef,
      sourceName,
      viewName,
    });

    this.onReceiveMessage(async message => {
      switch (message.type) {
        case ComposerPageMessageType.RunQuery:
          await this.runQuery(message);
          break;
        case ComposerPageMessageType.RefreshModel:
          await this.refreshModel(message);
          break;
      }
    });

    void this.initializeIndex();
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

  async initializeIndex(): Promise<SearchValueMapResult[] | undefined> {
    const sourceDef = getSourceDef(this.modelDef, this.sourceName);
    const indexQuery = sourceDef.fields.find(
      ({name, as}) => (as || name) === 'search_index'
    );
    const limit =
      vscode.workspace
        .getConfiguration('malloy')
        .get<number>('indexSearchLimit') ?? 100;

    if (indexQuery) {
      const searchMapMalloy = `
        run: ${this.sourceName}
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
        `Search index for ${this.sourceName}`,
        searchMapMalloy
      );
      if (result) {
        this.postMessage({
          type: ComposerMessageType.SearchIndex,
          result,
        });
      }
    }
    return undefined;
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
      this.postMessage({
        type: ComposerMessageType.NewModel,
        documentMeta: this.documentMeta,
        modelDef,
        sourceName: this.sourceName,
      });
      void vscode.window.showInformationMessage('Model refreshed');
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

  dispose() {}
}

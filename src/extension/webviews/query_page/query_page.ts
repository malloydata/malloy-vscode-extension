/*
 * Copyright 2024 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {
  Explore,
  Field,
  NamedQuery,
  QueryField,
  QueryResult,
  Result,
} from '@malloydata/malloy';
import {HTMLView} from '@malloydata/render';
import {css, html, LitElement, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {when} from 'lit/directives/when.js';
import {MutationController} from '@lit-labs/observers/mutation-controller.js';

import {
  QueryDownloadOptions,
  QueryMessageStatus,
  QueryMessageType,
  QueryPanelMessage,
  QueryRunStats,
  QueryRunStatus,
} from '../../../common/message_types';
import {fieldType} from '../../../common/schema';
import {copy} from '../assets/copy';

import {ResultKind, resultKindFromString} from './result_kind_toggle';
import {VsCodeApi} from '../vscode_wrapper';
import {convertFromBytes} from '../../../common/convert_to_bytes';

import '../components/labeled_spinner';
import '../components/schema_renderer';
import '../components/prism_container';
import './download_button';
import './error_panel';

type ResultMetadata = Omit<QueryResult, 'result' | 'sql'>;

interface Results {
  canDownloadStream?: boolean;
  stats?: QueryRunStats;
  html?: HTMLElement;
  sql?: string;
  json?: string;
  metadataOnly?: ResultMetadata;
  schema?: Explore[];
  profilingUrl?: string;
  queryCostBytes?: number;
  warning?: string;
}

@customElement('query-page')
export class QueryPage extends LitElement {
  @property({type: Object})
  vscode!: VsCodeApi<QueryPanelMessage, void>;

  @property() resultKind = ResultKind.HTML;

  @property({attribute: false})
  progressMessage = '';

  @property({attribute: false})
  error = '';

  @property({type: Object, attribute: false})
  results: Results = {};

  @property({type: Boolean, attribute: false})
  showOnlySql = false;

  @property({type: Boolean, attribute: false})
  showOnlySchema = false;

  @property({type: Boolean, attribute: false})
  isDarkMode = false;

  readonly mutationController = new MutationController(this, {
    target: document.body,
    callback: () => {
      this.isDarkMode =
        document.body.dataset['vscodeThemeKind'] === 'vscode-dark';
    },
    config: {
      attributeFilter: ['data-vscode-theme-kind'],
    },
  });

  static override styles = css`
    .container {
      height: 100%;
      margin: 0;
      display: flex;
      flex-direction: column;
    }
    .result-controls-bar {
      display: flex;
      border-bottom: 1px solid var(--vscode-panel-border);
      justify-content: space-between;
      align-items: center;
      color: var(--vscode-foreground);
      padding: 0 10px;
      user-select: none;
      height: 2em;
    }
    .result-label {
      font-weight: 500;
      font-size: 12px;
    }
    .result-controls-items {
      display: flex;
      align-items: center;
    }
    .result-container {
      padding: 10px;
      height: calc(100% - 20px);
    }
    .scroll {
      flex: 1;
      overflow: auto;

      &::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      &::-webkit-scrollbar-corner {
        background: var(--vscode-input-background, #3c3c3c);
      }
      &::-webkit-scrollbar-thumb {
        background: var(--vscode-scrollbarSlider-background, #79797966);
      }
      &::-webkit-scrollbar-thumb:hover {
        background: var(--vscode-scrollbarSlider-hoverBackground, #646464b3);
      }
      &::-webkit-scrollbar-thumb:active {
        background: var(--vscode-scrollbarSlider-activeBackground, #bfbfbf66);
      }
    }
    .stats {
      display: flex;
      color: var(--vscode-editorWidget-Foreground);
      background-color: var(--vscode-editorWidget-background);
      font-size: 12px;
      padding: 5px;
    }
    .profiling-url {
      padding-left: 10px;
      font-weight: bold;
      color: var(--vscode-editorWidget-Foreground);
    }
    .scroll:hover .copy-button {
      display: block;
    }
    .copy-button {
      width: 25px;
      height: 25px;
      position: absolute;
      bottom: 35px;
      right: 25px;
      background-color: var(--vscode-editorWidget-background);
      color: var(--vscode-editorWidget-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 4px;
      cursor: pointer;
      z-index: 1;
      display: none;
    }
    .copy-button svg {
      width: 25px;
      height: 25px;
    }
    .warning {
      color: var(--vscode-statusBarItem-warningForeground);
      background-color: var(--vscode-statusBarItem-warningBackground);
      font-size: 12px;
      padding: 5px;
    }
  `;

  onMessage = (event: MessageEvent<QueryMessageStatus>) => {
    const message = event.data;
    const {status} = message;

    switch (status) {
      case QueryRunStatus.Compiling:
        this.error = '';
        this.showOnlySchema = false;
        this.showOnlySql = false;
        this.progressMessage = 'Compiling';
        break;
      case QueryRunStatus.Running:
        this.progressMessage = 'Running';
        break;
      case QueryRunStatus.Error:
        this.error = message.error;
        break;
      case QueryRunStatus.Compiled:
        if (message.showSQLOnly) {
          this.progressMessage = '';
          this.showOnlySql = true;
          this.showOnlySchema = false;
          this.resultKind = ResultKind.SQL;
          this.results = {sql: message.sql};
        } else {
          this.progressMessage = 'Compiled';
        }
        break;
      case QueryRunStatus.EstimatedCost:
        {
          const {queryCostBytes, schema} = message;
          this.progressMessage = '';
          this.results = {
            ...this.results,
            queryCostBytes,
            schema: schema.map(json => Explore.fromJSON(json)),
          };
        }
        break;
      case QueryRunStatus.Schema:
        {
          const {schema} = message;
          this.progressMessage = '';
          this.results = {
            ...this.results,
            schema: schema.map(json => Explore.fromJSON(json)),
          };
          this.resultKind = ResultKind.SCHEMA;
          this.showOnlySchema = true;
        }
        break;
      case QueryRunStatus.Done: {
        const {canDownloadStream, resultJson, defaultTab, stats, profilingUrl} =
          message;

        const defaultKind = resultKindFromString(defaultTab);
        if (defaultKind) {
          this.resultKind = defaultKind;
        }
        const result = Result.fromJSON(resultJson);
        this.showOnlySql = false;
        this.showOnlySchema = false;
        const {data, sql} = result;

        let warning: string | undefined;
        if (data.rowCount < result.totalRows) {
          const rowCount = data.rowCount.toLocaleString();
          const totalRows = result.totalRows.toLocaleString();
          warning = `Row limit hit. Viewing ${rowCount} of ${totalRows} results.`;
        }

        const queryCostBytes = result.runStats?.queryCostBytes;
        const json = JSON.stringify(data.toObject(), null, 2);
        const schema = [result.resultExplore];
        const {sql: _s, result: _r, ...metadataOnly} = resultJson.queryResult;

        this.results = {
          json,
          schema,
          sql,
          metadataOnly,
          profilingUrl,
          queryCostBytes,
          stats,
          // TODO(whscullin) Lens Query Panel
          // Fix canDownload/canDownload stream distinction
          canDownloadStream,
          warning,
        };

        this.progressMessage = 'Rendering';

        new HTMLView(document)
          .render(result, {
            dataStyles: {},
            isDrillingEnabled: true,
            onDrill: (
              drillQuery: string,
              _target: HTMLElement,
              _drillFilters: string[]
            ) => {
              const status = QueryRunStatus.RunCommand;
              const command = 'malloy.copyToClipboard';
              const args = [drillQuery, 'Query'];
              // TODO(cbhagwat): Fix this.
              this.vscode.postMessage({status, command, args});
            },
          })
          .then(html => {
            this.progressMessage = '';
            this.results = {
              ...this.results,
              html,
            };
          });
      }
    }
  };

  /*
   * Intercept the context menu click from the schema renderer, and
   * apply context data to the element's `vscode-context` attribute.
   * Then simulate a context click so that VS Code will pick up
   * the context and draw a context menu.
   */
  onContextClick = (event: MouseEvent, context: Record<string, unknown>) => {
    event.stopPropagation();
    event.preventDefault();

    context = {...context, preventDefaultContextMenuItems: true};
    this.dataset['vscodeContext'] = JSON.stringify(context);
    this.dispatchEvent(
      new MouseEvent('contextmenu', {
        clientX: event.clientX,
        clientY: event.clientY,
        bubbles: true,
      })
    );
  };

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('message', this.onMessage);
    this.vscode.postMessage({type: QueryMessageType.AppReady});
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('message', this.onMessage);
  }

  override render() {
    if (this.error) {
      return html` <div class="container">
        <error-panel .message=${this.error}></error-panel>
      </div>`;
    } else if (this.progressMessage) {
      return html`<labeled-spinner
        text=${this.progressMessage}
      ></labeled-spinner>`;
    } else {
      return html` <div class="container">
        <div class="result-controls-bar">
          <span class="result-label">
            ${this.showOnlySql
              ? 'SQL'
              : this.showOnlySchema
              ? 'SCHEMA'
              : 'QUERY RESULTS'}
          </span>
          ${when(
            !this.showOnlySchema,
            () =>
              html`<div class="result-controls-items">
                <result-kind-toggle
                  .showOnlySql=${this.showOnlySql}
                  .resultKind=${this.resultKind}
                  .setKind=${(kind: ResultKind) => {
                    this.resultKind = kind;
                  }}
                >
                </result-kind-toggle>
                ${when(
                  this.results.canDownloadStream,
                  () =>
                    html`<download-button
                      ?canStream=${this.results.canDownloadStream || false}
                      .onDownload=${async (
                        downloadOptions: QueryDownloadOptions
                      ) => {
                        this.vscode.postMessage({
                          status: QueryRunStatus.StartDownload,
                          downloadOptions,
                        });
                      }}
                    ></download-button>`
                )}
              </div>`
          )}
        </div>
        ${when(
          !this.showOnlySql &&
            this.resultKind === ResultKind.HTML &&
            this.results.html,
          () =>
            html` <div class="scroll">
              <div class="result-container">
                ${this.results.html}
                <div
                  class="copy-button"
                  @click=${() =>
                    this.copyToClipboard(
                      this.getStyledHTML(this.results.html!)
                    )}
                >
                  ${copy}
                </div>
              </div>
            </div>`,
          () => nothing
        )}
        ${when(
          !this.showOnlySql &&
            this.resultKind === ResultKind.JSON &&
            this.results.json,
          () => {
            return html` <div class="scroll">
              <prism-container
                .code="${this.results.json!}"
                .language="${'json'}"
                .darkMode="${this.isDarkMode}"
              >
              </prism-container>
              <div
                class="copy-button"
                @click=${() => this.copyToClipboard(this.results.json!)}
              >
                ${copy}
              </div>
            </div>`;
          },
          () => nothing
        )}
        ${when(
          !this.showOnlySql &&
            this.resultKind === ResultKind.METADATA &&
            this.results.metadataOnly,
          () => {
            return html` <div class="scroll">
              </prism-container>
              <prism-container
                .code="${JSON.stringify(this.results.metadataOnly, null, 2)}"
                .language="${'json'}"
                .darkMode="${this.isDarkMode}"
              >
              </prism-container>
              <div
                class="copy-button"
                @click=${() => this.copyToClipboard(this.results.json!)}
              >
                ${copy}
              </div>
            </div>`;
          },
          () => nothing
        )}
        ${when(
          !this.showOnlySql &&
            this.resultKind === ResultKind.SCHEMA &&
            this.results.schema,
          () =>
            html` <div class="scroll">
              <schema-renderer
                style="margin: 10px;"
                .explores=${this.results.schema!}
                .queries=${[]}
                .defaultShow=${true}
                .onFieldClick=${(field: Field) => this.onFieldClick(field)}
                .onQueryClick=${(query: NamedQuery | QueryField) =>
                  this.onQueryClick(query)}
                .onContextClick=${this.onContextClick}
              >
              </schema-renderer>
            </div>`,
          () => nothing
        )}
        ${when(
          this.resultKind === ResultKind.SQL && this.results.sql,
          () => {
            return html` <div class="scroll">
              <div>
                <prism-container
                  .code="${this.results.sql!}"
                  .language="${'sql'}"
                  .darkMode="${this.isDarkMode}"
                >
                </prism-container>
                <div
                  class="copy-button"
                  @click=${() => this.copyToClipboard(this.results.sql!)}
                >
                  ${copy}
                </div>
              </div>
            </div>`;
          },
          () => nothing
        )}
        ${when(
          this.results.stats ||
            this.results.profilingUrl ||
            this.results.queryCostBytes,
          () =>
            html` <div class="stats">
              ${this.getStats(
                this.results.stats,
                this.results.profilingUrl,
                this.results.queryCostBytes
              )}
            </div>`,
          () => nothing
        )}
        ${when(
          this.results.warning,
          () => html`<div class="warning">${this.results.warning}</div>`
        )}
      </div>`;
    }

    return nothing;
  }

  getStats(
    stats?: QueryRunStats,
    profilingUrl?: string,
    queryCostBytes?: number
  ) {
    return html`${stats
      ? html`Compile Time: ${stats.compileTime.toLocaleString()}s, Run Time:
        ${stats.runTime.toLocaleString()}s, Total Time:
        ${stats.totalTime.toLocaleString()}s.`
      : nothing}
    ${this.getQueryCostStats(queryCostBytes, this.showOnlySql) ?? ''}
    ${this.getProfilingUrlLink(profilingUrl)}`;
  }

  getQueryCostStats(queryCostBytes?: number, isEstimate?: boolean) {
    if (typeof queryCostBytes !== 'number') {
      return nothing;
    }

    if (queryCostBytes) {
      return `${isEstimate ? 'Will process' : 'Processed'} ${convertFromBytes(
        queryCostBytes
      )}`;
    } else {
      return 'From cache.';
    }
  }

  getProfilingUrlLink(profilingUrl?: string) {
    return profilingUrl
      ? html` <a class="profiling-url" href="${profilingUrl}"
          >Query Profile Page</a
        >`
      : nothing;
  }

  copyToClipboard(text: string) {
    const status = QueryRunStatus.RunCommand;
    const command = 'malloy.copyToClipboard';
    const args = [text, 'Results'];
    this.vscode.postMessage?.({status, command, args});
  }

  onFieldClick(field: Field) {
    const type = fieldType(field);

    if (type !== 'query') {
      let path = field.name;
      let current: Explore = field.parentExplore;
      while (current.parentExplore) {
        path = `${current.name}.${path}`;
        current = current.parentExplore;
      }
      this.copyToClipboard(path);
    }
  }

  onQueryClick(query: NamedQuery | QueryField) {
    if ('parentExplore' in query) {
      const status = QueryRunStatus.RunCommand;
      const command = 'malloy.runQuery';
      const arg1 = `run: ${query.parentExplore.name}->${query.name}`;
      const arg2 = `${query.parentExplore.name}->${query.name}`;
      const args = [arg1, arg2];
      this.vscode.postMessage({status, command, args});
    }
  }

  getStyledHTML(html: HTMLElement): string {
    const resolveStyles = getComputedStyle(html);
    const styles = /* html */ `<style>
    :root {
      --malloy-font-family: ${resolveStyles.getPropertyValue(
        '--malloy-font-family'
      )};
      --malloy-title-color: ${resolveStyles.getPropertyValue(
        '--malloy-title-color'
      )};
      --malloy-label-color: ${resolveStyles.getPropertyValue(
        '--malloy-label-color'
      )};
      --malloy-border-color: ${resolveStyles.getPropertyValue(
        '--malloy-border-color'
      )};
      --malloy-tile-background-color: ${resolveStyles.getPropertyValue(
        '--malloy-tile-background-color'
      )};
    }
    body {
      color: ${resolveStyles.getPropertyValue('--foreground')};
      background: ${resolveStyles.getPropertyValue('--background')};
      font-family: var(--malloy-font-family);
      font-size: 11px;
    }
    table {
      font-size: 11px;
    }
  </style>
  `;
    return styles + html.outerHTML;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'query-page': QueryPage;
  }
}

/*
 * Copyright 2023 Google LLC
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

import {LitElement, html, render} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import {Explore, Field, NamedQuery, QueryField} from '@malloydata/malloy';
import {ActivationFunction} from 'vscode-notebook-renderer';
import {FetchModelMessage} from '../../../common/message_types';
import {fieldType} from '../../../common/schema';
import '../../webviews/components/schema_renderer';
import {MalloyRendererMessage} from '../types';

export const activate: ActivationFunction = ({postMessage}) => {
  return {
    renderOutputItem(info, element) {
      let shadow = element.shadowRoot;
      if (!shadow) {
        shadow = element.attachShadow({mode: 'open'});
        const root = document.createElement('div');
        root.id = 'root';
        shadow.append(root);
      }
      const root = shadow.querySelector<HTMLElement>('#root');
      if (!root) {
        throw new Error('Element #root not found');
      }

      render(
        html`<schema-renderer-wrapper
          .results=${info.json()}
          .postMessage=${postMessage}
        ></schema-renderer-wrapper>`,
        root
      );
    },
  };
};

/**
 * SchemaRendererWrapper exists as a buffer for StyleSheetManager, which
 * needs our element to exist before we render any styled content, so
 * we use useEffect() to delay rendering the actual contents until
 * it's ready.
 */

@customElement('schema-renderer-wrapper')
export class SchemaRendererWrapper extends LitElement {
  @property({type: Object}) results?: FetchModelMessage;
  @property({type: Object}) postMessage?: (
    message: MalloyRendererMessage
  ) => void;

  onFieldClick = (field: Field) => {
    const type = fieldType(field);
    const {fieldPath} = field;
    const topLevelExplore = fieldPath.shift();
    const accessPath = fieldPath.join('.');

    if (type === 'query') {
      const command = 'malloy.runQuery';
      const queryString = `run: ${topLevelExplore}->${accessPath}`;
      const title = `${topLevelExplore}->${accessPath}`;
      const args = [queryString, title];
      this.postMessage?.({command, args});
    } else {
      const command = 'malloy.copyToClipboard';
      const args = [accessPath, 'Path'];
      this.postMessage?.({command, args});
    }
  };

  onQueryClick = (query: NamedQuery | QueryField) => {
    if ('parentExplore' in query) {
      const {fieldPath} = query;
      const topLevelExplore = fieldPath.shift();
      const accessPath = fieldPath.join('.');
      const command = 'malloy.runQuery';
      const queryString = `run: ${topLevelExplore}->${accessPath}`;
      const title = `${topLevelExplore}->${accessPath}`;
      const args = [queryString, title];
      this.postMessage?.({command, args});
    } else {
      const command = 'malloy.runNamedQuery';
      const args = [query.name];
      this.postMessage?.({command, args});
    }
  };

  onPreviewClick = (explore: Explore) => {
    const command = 'malloy.runQuery';
    const {fieldPath} = explore;
    const exploreName = fieldPath.shift();
    const accessPath = fieldPath.join('.');
    fieldPath.push('*');
    const select = fieldPath.join('.');
    const args = [
      `run: ${exploreName}->{ select: ${select}; limit: 20 }`,
      `Preview ${exploreName} ${accessPath}`,
      'html',
    ];
    this.postMessage?.({command, args});
  };

  onContextClick = (event: MouseEvent, context: Record<string, unknown>) => {
    event.stopPropagation();
    event.preventDefault();

    context = {...context, preventDefaultContextMenuItems: true};
    const root =
      window.document.querySelector<HTMLElement>('.output_container');
    if (!root) {
      return;
    }
    root.dataset['vscodeContext'] = JSON.stringify(context);
    root.dispatchEvent(
      new MouseEvent('contextmenu', {
        clientX: event.clientX,
        clientY: event.clientY,
        bubbles: true,
      })
    );
  };

  constructor() {
    super();
  }

  override render() {
    if (!this.results) {
      return null;
    }
    const explores = this.results.explores.map(json => Explore.fromJSON(json));

    return html`<schema-renderer
      ?defaultShow=${false}
      .explores=${explores}
      .queries=${this.results.queries}
      .onFieldClick=${this.onFieldClick}
      .onQueryClick=${this.onQueryClick}
      .onPreviewClick=${this.onPreviewClick}
      .onContextClick=${this.onContextClick}
    ></schema-renderer>`;
  }
}

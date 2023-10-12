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
        />`,
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
  @property({type: Object}) postMessage?: (message: unknown) => void;

  onFieldClick = (field: Field) => {
    const type = fieldType(field);

    let path = field.name;
    let current: Explore = field.parentExplore;
    while (current.parentExplore) {
      path = `${current.name}.${path}`;
      current = current.parentExplore;
    }
    const topLevelExplore = current;

    if (type === 'query') {
      const type = 'malloy.runQuery';
      const args = [
        `run: ${topLevelExplore.name}->${path}`,
        `${topLevelExplore.name}->${path}`,
      ];
      this.postMessage?.({type, args});
    } else {
      let path = field.name;
      let current: Explore = field.parentExplore;
      while (current.parentExplore) {
        path = `${current.name}.${path}`;
        current = current.parentExplore;
      }
      navigator.clipboard.writeText(path);
    }
  };

  onQueryClick = (query: NamedQuery | QueryField) => {
    if ('parentExplore' in query) {
      const type = 'malloy.runQuery';
      const arg1 = `run: ${query.parentExplore.name}->${query.name}`;
      const arg2 = `${query.parentExplore.name}->${query.name}`;
      const args = [arg1, arg2];
      this.postMessage?.({type, args});
    } else {
      const type = 'malloy.runNamedQuery';
      const args = [query.name];
      this.postMessage?.({type, args});
    }
  };

  onPreviewClick = (explore: Explore) => {
    const type = 'malloy.runQuery';
    const parts = [];
    let current: Explore | undefined = explore;
    while (current) {
      parts.unshift(current.name);
      current = current.parentExplore;
    }
    parts.push('*');
    const exploreName = parts.shift();
    const select = parts.join('.');
    const args = [
      `run: ${exploreName}->{ select: ${select}; limit: 20 }`,
      `preview ${explore.name}`,
      'html',
    ];
    this.postMessage?.({type, args});
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
    />`;
  }
}

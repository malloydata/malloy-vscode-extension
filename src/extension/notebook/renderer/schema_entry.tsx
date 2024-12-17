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

import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {Explore, Field, NamedQuery, QueryField} from '@malloydata/malloy';
import {ActivationFunction} from 'vscode-notebook-renderer';
import {FetchModelMessage} from '../../../common/types/message_types';
import {fieldType} from '../../../common/schema';
import '../../webviews/components/schema_renderer';
import {MalloyRendererMessage} from '../types';
import {SchemaRenderer} from '../../webviews/components/SchemaRenderer';
import {StyleSheetManager} from 'styled-components';

export const activate: ActivationFunction = ({postMessage}) => {
  return {
    renderOutputItem(info, element) {
      let shadow = element.shadowRoot;
      if (!shadow) {
        shadow = element.attachShadow({mode: 'open'});
        const root = document.createElement('div');
        const styledRoot = document.createElement('div');
        styledRoot.id = 'styled-root';
        shadow.append(styledRoot);
        root.id = 'root';
        styledRoot.append(root);
      }
      const root = shadow.querySelector<HTMLElement>('#root');
      const styledRoot = shadow.querySelector<HTMLElement>('#styled-root');
      if (!root || !styledRoot) {
        throw new Error('Element #root not found');
      }
      const reactRoot = createRoot(root);
      reactRoot.render(
        <StyleSheetManager target={styledRoot}>
          <SchemaRendererWrapper
            results={info.json()}
            postMessage={postMessage}
          />
        </StyleSheetManager>
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

export interface SchemaRendererWrapperProps {
  results?: FetchModelMessage;
  postMessage?: (message: MalloyRendererMessage) => void;
}

export function SchemaRendererWrapper({
  results,
  postMessage,
}: SchemaRendererWrapperProps) {
  const onFieldClick = (field: Field) => {
    const type = fieldType(field);
    const {fieldPath} = field;
    const topLevelExplore = fieldPath.shift();
    const accessPath = fieldPath.join('.');

    if (type === 'query') {
      const command = 'malloy.runQuery';
      const queryString = `run: ${topLevelExplore}->${accessPath}`;
      const title = `${topLevelExplore}->${accessPath}`;
      const args = [queryString, title];
      postMessage?.({command, args});
    } else {
      const command = 'malloy.copyToClipboard';
      const args = [accessPath, 'Path'];
      postMessage?.({command, args});
    }
  };

  const onQueryClick = (query: NamedQuery | QueryField) => {
    if ('parentExplore' in query) {
      const {fieldPath} = query;
      const topLevelExplore = fieldPath.shift();
      const accessPath = fieldPath.join('.');
      const command = 'malloy.runQuery';
      const queryString = `run: ${topLevelExplore}->${accessPath}`;
      const title = `${topLevelExplore}->${accessPath}`;
      const args = [queryString, title];
      postMessage?.({command, args});
    } else {
      const command = 'malloy.runNamedQuery';
      const args = [query.name];
      postMessage?.({command, args});
    }
  };

  const onPreviewClick = (explore: Explore) => {
    const command = 'malloy.runQuery';
    const {fieldPath} = explore;
    const exploreName = fieldPath.shift();
    const accessPath = fieldPath.join('.');
    fieldPath.push('*');
    const select = fieldPath.join('.');
    const args = [
      `run: ${exploreName}->{ select: ${select}; limit: 20 }`,
      `Preview ${exploreName} ${accessPath}`,
      'preview',
    ];
    postMessage?.({command, args});
  };

  if (!results) {
    return null;
  }
  const explores = results.explores.map(json => Explore.fromJSON(json));

  return (
    <SchemaRenderer
      defaultShow={explores.length === 1}
      explores={explores}
      queries={results.queries}
      onFieldClick={onFieldClick}
      onQueryClick={onQueryClick}
      onPreviewClick={onPreviewClick}
    />
  );
}

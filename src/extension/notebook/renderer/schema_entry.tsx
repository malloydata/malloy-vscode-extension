/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {Explore, Field, NamedQueryDef, QueryField} from '@malloydata/malloy';
import {ActivationFunction} from 'vscode-notebook-renderer';
import {FetchModelMessage} from '../../../common/types/message_types';
import {fieldType} from '../../../common/schema';
import {MalloyRendererMessage} from '../types';
import {SchemaRenderer} from '../../webviews/components/SchemaRenderer';
import {StyleSheetManager} from 'styled-components';

export const activate: ActivationFunction = ({postMessage}) => {
  return {
    renderOutputItem(info, element) {
      const root = document.createElement('div');
      const styledRoot = document.createElement('div');
      styledRoot.id = 'styled-root';
      root.id = 'root';
      styledRoot.append(root);
      element.append(styledRoot);
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

  const onQueryClick = (query: NamedQueryDef | QueryField) => {
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
      `Preview: ${exploreName} ${accessPath}`,
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

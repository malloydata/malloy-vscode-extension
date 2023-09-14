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

import ReactDOM from 'react-dom';
import React from 'react';
import {StyleSheetManager} from 'styled-components';
import {ActivationFunction} from 'vscode-notebook-renderer';
import {SchemaRenderer} from '../../webviews/components/SchemaRenderer';
import {Explore, Field, NamedQuery, QueryField} from '@malloydata/malloy';
import {fieldType} from '../../common/schema';
import {FetchModelMessage} from '../../../common/message_types';

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

      ReactDOM.render(
        <StyleSheetManager target={root}>
          <SchemaRendererWrapper
            results={info.json()}
            postMessage={postMessage}
          />
        </StyleSheetManager>,
        root
      );
    },
  };
};

interface SchemaRendererWrapperProps {
  results: FetchModelMessage;
  postMessage?: (message: unknown) => void;
}

/**
 * SchemaRendererWrapper exists as a buffer for StyleSheetManager, which
 * needs our element to exist before we render any styled content, so
 * we use useEffect() to delay rendering the actual contents until
 * it's ready.
 */
const SchemaRendererWrapper = ({
  results,
  postMessage,
}: SchemaRendererWrapperProps) => {
  const [explores, setExplores] = React.useState<Explore[]>();
  const [queries, setQueries] = React.useState<NamedQuery[]>();

  React.useEffect(() => {
    if (results) {
      setExplores(results.explores.map(json => Explore.fromJSON(json)));
      setQueries(results.queries);
    }
  }, [results]);

  if (!explores || !queries) {
    return null;
  }

  const onFieldClick = (field: Field) => {
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
        `query: ${topLevelExplore.name}->${path}`,
        `${topLevelExplore.name}->${path}`,
      ];
      postMessage?.({type, args});
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

  const onQueryClick = (query: NamedQuery | QueryField) => {
    if ('parentExplore' in query) {
      const type = 'malloy.runQuery';
      const arg1 = `query: ${query.parentExplore.name}->${query.name}`;
      const arg2 = `${query.parentExplore.name}->${query.name}`;
      const args = [arg1, arg2];
      postMessage?.({type, args});
    } else {
      const type = 'malloy.runNamedQuery';
      const args = [query.name];
      postMessage?.({type, args});
    }
  };

  return (
    <SchemaRenderer
      explores={explores}
      queries={queries}
      onFieldClick={onFieldClick}
      onQueryClick={onQueryClick}
    />
  );
};

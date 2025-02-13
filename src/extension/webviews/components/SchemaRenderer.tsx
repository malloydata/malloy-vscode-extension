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

import {Explore, Field, NamedQuery, QueryField} from '@malloydata/malloy';
import {
  exploreSubtype,
  fieldType,
  getTypeLabel,
  isFieldAggregate,
  isFieldHidden,
} from '../../../common/schema';

import ArrayIcon from '../../../../img/data-type-array.svg';
import BooleanIcon from '../../../../img/boolean.svg';
import ChevronRightIcon from '../../../../img/chevron_right.svg';
import ChevronDownIcon from '../../../../img/chevron_down.svg';
import ManyToOneIcon from '../../../../img/many_to_one.svg';
import NumberIcon from '../../../../img/number.svg';
import NumberAggregateIcon from '../../../../img/number-aggregate.svg';
import OneToManyIcon from '../../../../img/one_to_many.svg';
import OneToOneIcon from '../../../../img/one_to_one.svg';
import QueryIcon from '../../../../img/turtle.svg';
import RecordIcon from '../../../../img/data-type-json.svg';
import SqlNativeIcon from '../../../../img/sql-database.svg';
import StringIcon from '../../../../img/string.svg';
import TimeIcon from '../../../../img/time.svg';
import UnknownIcon from '../../../../img/unknown.svg';

import {ReactElement, useState} from 'react';
import styled from 'styled-components';

const sortByName = (a: {name: string}, b: {name: string}) =>
  a.name.localeCompare(b.name);

const fieldContext = (field: Field) => {
  const {fieldPath: accessPath, location, name} = field;
  const topLevelExplore = accessPath.shift();

  return {
    accessPath,
    location,
    name,
    topLevelExplore,
    preventDefaultContextMenuItems: true,
  };
};
/**
 * Bucket fields by type and sort by name.
 *
 * @param fields Source fields
 * @returns An objects with four arrays, one for each of queries, dimensions,
 *   measures and explores/sources, sorted by name
 */

function bucketFields(fields: Field[]) {
  const queries: Field[] = [];
  const dimensions: Field[] = [];
  const measures: Field[] = [];
  const explores: Explore[] = [];

  for (const field of fields) {
    const type = fieldType(field);

    if (!isFieldHidden(field)) {
      if (isFieldAggregate(field)) {
        measures.push(field);
      } else if (field.isExploreField()) {
        if (field.isArray) {
          dimensions.push(field);
        } else {
          explores.push(field);
        }
      } else if (type === 'query') {
        queries.push(field);
      } else {
        dimensions.push(field) && !isFieldHidden(field);
      }
    }
  }

  return {
    queries: queries.sort(sortByName),
    dimensions: dimensions.sort(sortByName),
    measures: measures.sort(sortByName),
    explores: explores.sort(sortByName),
  };
}

/**
 * Returns the corresponding icon for fields and relationships.
 *
 * @param fieldType Field type and returned by fieldType()
 * @param isAggregate Field aggregate status as returned from isFieldAggregate()
 * @returns A React wrapped svg of the icon.
 */
function getIconElement(fieldType: string, isAggregate: boolean) {
  let imageElement: ReactElement | null;
  if (isAggregate) {
    imageElement = <NumberAggregateIcon />;
  } else {
    switch (fieldType) {
      case 'array':
        imageElement = <ArrayIcon />;
        break;
      case 'struct_record':
        imageElement = <RecordIcon />;
        break;
      case 'number':
        imageElement = <NumberIcon />;
        break;
      case 'string':
        imageElement = <StringIcon />;
        break;
      case 'date':
      case 'timestamp':
        imageElement = <TimeIcon />;
        break;
      case 'struct_base':
        imageElement = null;
        break;
      case 'struct_one_to_many':
        imageElement = <OneToManyIcon />;
        break;
      case 'struct_one_to_one':
        imageElement = <OneToOneIcon />;
        break;
      case 'struct_many_to_one':
        imageElement = <ManyToOneIcon />;
        break;
      case 'boolean':
        imageElement = <BooleanIcon />;
        break;
      case 'query':
        imageElement = <QueryIcon />;
        break;
      case 'sql native':
        imageElement = <SqlNativeIcon />;
        break;
      default:
        imageElement = <UnknownIcon />;
    }
  }

  return imageElement;
}

/**
 * Preview schema have non-friendly names like '__stage0', give them
 * something friendlier.
 */
function getExploreName(explore: Explore, path: string) {
  if (explore.name.startsWith('__stage')) {
    if (explore.parentExplore) {
      return explore.parentExplore.name;
    }
    return 'Preview';
  }
  return path ? path : explore.name;
}

/**
 * Generate some information for the tooltip over Field components.
 * Typically includes name, type and path
 *
 * @param field Field or explore to generate tooltip for
 * @param path Path to this field
 * @returns Tooltip text
 */
function buildTitle(field: Field, path: string) {
  const typeLabel = getTypeLabel(field);
  const fieldName = field.name;
  return `${fieldName}
Path: ${path}${path ? '.' : ''}${fieldName}
Type: ${typeLabel}`;
}

interface FieldItemProps {
  field: Field;
  path: string;
  onFieldClick?: (field: Field) => void;
}

function FieldItem({field, path, onFieldClick}: FieldItemProps) {
  const context = {
    webviewSection: 'malloySchemaField',
    ...fieldContext(field),
  };

  const onClick = () => {
    onFieldClick?.(field);
  };

  const clickable = onFieldClick ? 'clickable' : '';

  return (
    <div
      className={`field ${clickable}`}
      title={buildTitle(field, path)}
      onClick={onClick}
      data-vscode-context={JSON.stringify(context)}
    >
      {getIconElement(fieldType(field), isFieldAggregate(field))}
      <span className="field_name">{field.name}</span>
    </div>
  );
}

interface QueryItemProps {
  query: NamedQuery | QueryField;
  path: string;
  onQueryClick?: (query: NamedQuery | QueryField) => void;
}

const QueryItem = ({query, path, onQueryClick}: QueryItemProps) => {
  const onClick = () => {
    onQueryClick?.(query);
  };

  const clickable = onQueryClick ? 'clickable' : '';
  let context: Record<string, unknown> = {};

  if ('parentExplore' in query) {
    context = {
      webviewSection: 'malloySchemaQuery',
      ...fieldContext(query),
    };
  } else {
    context = {
      webviewSection: 'malloySchemaNamedQuery',
      name: query.name,
      location: query.location,
      preventDefaultContextMenuItems: true,
    };
  }

  const title = `${query.name}\nPath: ${path}${path ? '.' : ''}${query.name}`;

  return (
    <div
      className={`field ${clickable}`}
      onClick={onClick}
      data-vscode-context={JSON.stringify(context)}
    >
      {getIconElement('query', false)}
      <span title={title} className="field_name">
        {query.name}
      </span>
    </div>
  );
};

export interface StructItemProps {
  explore: Explore;
  path: string;
  onFieldClick?: (field: Field) => void;
  onQueryClick?: (query: NamedQuery | QueryField) => void;
  onPreviewClick?: (explore: Explore) => void;
  startHidden: boolean;
}

export function StructItem({
  explore,
  path,
  onFieldClick,
  onQueryClick,
  onPreviewClick,
  startHidden,
}: StructItemProps) {
  const [hidden, setHidden] = useState(startHidden);

  const toggleHidden = () => {
    setHidden(!hidden);
  };

  const onClick = (event: React.MouseEvent) => {
    if (!explore) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onPreviewClick?.(explore);
  };

  function fieldList(fields: Field[], path: string) {
    return (
      <div className="field_list">
        {fields.map(field =>
          field.isQueryField() ? (
            <QueryItem
              key={field.name}
              query={field}
              path={path}
              onQueryClick={onQueryClick}
            />
          ) : (
            <FieldItem
              key={field.name}
              field={field}
              path={path}
              onFieldClick={onFieldClick}
            />
          )
        )}
      </div>
    );
  }

  if (!explore) {
    return null;
  }

  const subtype = exploreSubtype(explore);
  const {queries, dimensions, measures, explores} = bucketFields(
    explore.allFields
  );

  const buildPath = (explore: Explore, path: string): string => {
    if (path) {
      return `${path}.${explore.name}`;
    } else {
      return explore.name;
    }
  };

  const classes = `schema ${hidden ? 'hidden' : ''}`;

  return (
    <li className={classes}>
      <div onClick={toggleHidden}>
        <span className="chevron">
          {hidden ? (
            <ChevronRightIcon width={22} height={22} />
          ) : (
            <ChevronDownIcon width={22} height={22} />
          )}
        </span>
        {getIconElement(`struct_${subtype}`, false)}
        <b className="explore_name">{getExploreName(explore, path)}</b>
        {onPreviewClick ? (
          <span className="preview" onClick={onClick}>
            {' '}
            Preview{' '}
          </span>
        ) : null}
      </div>
      <ul>
        {queries.length ? (
          <li className="fields">
            <label>Views</label>
            {fieldList(queries, path)}
          </li>
        ) : null}
        {dimensions.length ? (
          <li className="fields">
            <label>Dimensions</label>
            {fieldList(dimensions, path)}
          </li>
        ) : null}
        {measures.length ? (
          <li className="fields">
            <label>Measures</label>
            {fieldList(measures, path)}
          </li>
        ) : null}
        {explores.length
          ? explores.map(explore => (
              <StructItem
                key={explore.name}
                explore={explore}
                path={buildPath(explore, path)}
                onFieldClick={onFieldClick}
                onPreviewClick={onPreviewClick}
                onQueryClick={onQueryClick}
                startHidden={true}
              />
            ))
          : null}
      </ul>
    </li>
  );
}

export interface SchemaRendererProps {
  explores: Explore[];
  queries: NamedQuery[];
  onFieldClick?: (field: Field) => void;
  onQueryClick?: (query: NamedQuery | QueryField) => void;
  onPreviewClick?: (explore: Explore) => void;
  defaultShow: boolean;
}

export function SchemaRenderer({
  explores,
  queries,
  onFieldClick,
  onQueryClick,
  onPreviewClick,
  defaultShow,
}: SchemaRendererProps) {
  const hidden = !defaultShow;

  return (
    <Schema>
      <ul>
        <li>
          <div className="field_list">
            {queries.sort(sortByName).map(query => (
              <QueryItem
                key={query.name}
                query={query}
                path={query.name}
                onQueryClick={onQueryClick}
              />
            ))}
          </div>
        </li>
        {explores.sort(sortByName).map(explore => (
          <StructItem
            key={explore.name}
            explore={explore}
            path=""
            onFieldClick={onFieldClick}
            onPreviewClick={onPreviewClick}
            onQueryClick={onQueryClick}
            startHidden={hidden}
          />
        ))}
      </ul>
    </Schema>
  );
}

const Schema = styled.div`
  color: var(--vscode-foreground);
  display: block;

  ul {
    margin: 5px 0;
    padding: 0 0.75em;
    list-style-type: none;
  }

  li.schema {
    list-style: none;
  }

  .hidden ul {
    display: none;
  }

  li.fields {
    margin: 2px 0;
  }

  li.fields label {
    display: block;
    font-size: 10px;
    margin-left: 5px;
    margin-top: 0.5em;
    text-transform: uppercase;
  }

  .explore_name {
    line-height: 2em;
    font-weight: 600;
  }

  .field {
    white-space: nowrap;
    display: flex;
    vertical-align: middle;
    border: 1px solid var(--vscode-notebook-cellBorderColor);
    border-radius: 8px;
    padding: 0.25em 0.75em;
    margin: 0.2em;

    &.clickable {
      cursor: pointer;
    }
  }

  .field_list {
    display: flex;
    flex-wrap: wrap;
    margin-top: 0.25em;
  }

  .field_name {
    padding-left: 0.5em;
    user-select: none;
  }

  svg {
    position: relative;
    left: -2px;
  }

  .field_name,
  svg,
  span,
  b {
    vertical-align: middle;
    display: inline-block;
  }

  .preview {
    color: var(--vscode-editorCodeLens-foreground);
    font-size: 0.8em;
    padding-left: 5px;
    cursor: pointer;

    &:hover {
      color: var(--vscode-editorLink-activeForeground);
    }
  }

  .chevron {
    color: var(--vscode-icon-foreground);
  }
`;

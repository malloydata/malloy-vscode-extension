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
import styled from 'styled-components';
import {Explore, Field} from '@malloydata/malloy';
import {exploreSubtype, fieldType, isFieldAggregate} from '../../common/schema';
import NumberIcon from '../../../media/number.svg';
import NumberAggregateIcon from '../../../media/number-aggregate.svg';
import BooleanIcon from '../../../media/boolean.svg';
import TimeIcon from '../../../media/time.svg';
import QueryIcon from '../../../media/turtle.svg';
import StringIcon from '../../../media/string.svg';
import OneToManyIcon from '../../../media/one_to_many.svg';
import ManyToOneIcon from '../../../media/many_to_one.svg';
import OneToOneIcon from '../../../media/one_to_one.svg';

/**
 * Props for the SchemaRenderer component
 */
export interface SchemaRendererProps {
  explores: Explore[];
}

/**
 * Properties for the Field component
 */
interface FieldProps {
  field: Field;
  path: string;
}

/**
 * Properties for the FieldList component
 */
interface FieldListProps {
  fields: Field[];
  path: string;
}

/**
 * Properties for the Explore component
 */
interface ExploreProps {
  explore: Explore;
  path: string;
}

/**
 * Returns the corresponding icon for fields and relationships.
 *
 * @param fieldType Field type and returned by fieldType()
 * @param isAggregate Field aggregate status as returned from isFieldAggregate()
 * @returns A React wrapped svg of the icon.
 */
function getIconElement(fieldType: string, isAggregate: boolean) {
  let imageElement;
  if (isAggregate) {
    imageElement = <NumberAggregateIcon />;
  } else {
    switch (fieldType) {
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
      default:
        imageElement = null;
    }
  }

  return imageElement;
}

/**
 * Generate some information for the tooltip over Field components.
 * Typically includes name, type and path
 *
 * @param field Field or explore to generate tooltip for
 * @param path Path to this field
 * @returns Tooltip text
 */
function buildTitle(field: Field | Explore, path: string) {
  if (field.isExplore()) {
    return field.name;
  }
  const type = fieldType(field);
  const fieldName = field.name;
  return `${fieldName}
Path: ${path}${path ? '.' : ''}${fieldName}
Type: ${type}`;
}

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

  const sortByName = (a: Field | Explore, b: Field | Explore) =>
    a.name.localeCompare(b.name);

  for (const field of fields) {
    const type = fieldType(field);

    if (isFieldAggregate(field)) {
      measures.push(field);
    } else if (field.isExploreField()) {
      explores.push(field);
    } else if (type === 'query') {
      queries.push(field);
    } else {
      dimensions.push(field);
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
 * SchemaRenderer component. Generates a schema tree with collapsible
 * field lists.
 */
export const SchemaRenderer: React.FC<SchemaRendererProps> = ({explores}) => {
  if (!explores || !explores.length) {
    return <b>No Schema Information</b>;
  }

  /**
   * StructItem component, handles hiding and showing of contents, and
   * separate lists for queries, dimensions and measures. Is
   * used recursively to support structures.
   */

  const StructItem = ({explore, path}: ExploreProps) => {
    const [hidden, setHidden] = React.useState<string>('hidden');
    const subtype = exploreSubtype(explore);
    const {queries, dimensions, measures, explores} = bucketFields(
      explore.allFields
    );

    const toggleHidden = React.useCallback(
      (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setHidden(old => (old === 'hidden' ? '' : 'hidden'));
      },
      [setHidden]
    );

    return (
      <li className={`schema ${hidden}`} title={buildTitle(explore, path)}>
        <div onClick={toggleHidden}>
          <span>{hidden ? '▶' : '▼'}</span>{' '}
          {getIconElement(`struct_${subtype}`, false)}{' '}
          <b className="explore_name">{explore.name}</b>
        </div>
        <ul>
          {queries.length ? (
            <li className="fields">
              <label>Queries</label>
              <FieldList fields={queries} path={path} />
            </li>
          ) : null}
          {dimensions.length ? (
            <li className="fields">
              <label>Dimensions</label>
              <FieldList fields={dimensions} path={path} />
            </li>
          ) : null}
          {measures.length ? (
            <li className="fields">
              <label>Measures</label>
              <FieldList fields={measures} path={path} />
            </li>
          ) : null}
          {explores.length
            ? explores.map(explore => (
                <StructItem
                  key={explore.name}
                  explore={explore}
                  path={`${path}${path ? '.' : ''}${explore.name}`}
                />
              ))
            : null}
        </ul>
      </li>
    );
  };

  /**
   * Individual field, consisting of icon and name, with a tooltip
   */

  const FieldItem = ({field, path}: FieldProps) => {
    return (
      <div className="field" title={buildTitle(field, path)}>
        {getIconElement(fieldType(field), isFieldAggregate(field))}
        <span className="field_name">{field.name}</span>
      </div>
    );
  };

  /**
   * A list of fields, for use with queries, dimensions and measures.
   */

  const FieldList = ({fields, path}: FieldListProps) => {
    return (
      <div className="field_list">
        {fields.map(field => (
          <FieldItem key={field.name} field={field} path={path} />
        ))}
      </div>
    );
  };

  return (
    <SchemaTree>
      <ul>
        {explores.map(explore => (
          <StructItem key={explore.name} explore={explore} path={''} />
        ))}
      </ul>
    </SchemaTree>
  );
};

/**
 * Styled SchemaTree component. Rather than have multiple styled components,
 * uses element types and class names for easier translation to the
 * IPython magic version.
 */
const SchemaTree = styled.div`
  color: var(--vscode-foreground);

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
  }

  .field_list {
    display: flex;
    flex-wrap: wrap;
    margin-top: 0.25em;
  }

  .field_name {
    padding-left: 0.5em;
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
`;

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

import {LitElement, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import styles from './schema_renderer.css';
import {Explore, Field, NamedQuery, QueryField} from '@malloydata/malloy';
import {
  exploreSubtype,
  fieldType,
  isFieldAggregate,
} from '../../../common/schema';
import {
  booleanIcon,
  manyToOneIcon,
  numberAggregateIcon,
  numberIcon,
  oneToManyIcon,
  oneToOneIcon,
  queryIcon,
  stringIcon,
  timeIcon,
} from './icons';

const sortByName = (a: {name: string}, b: {name: string}) =>
  a.name.localeCompare(b.name);

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
 * Returns the corresponding icon for fields and relationships.
 *
 * @param fieldType Field type and returned by fieldType()
 * @param isAggregate Field aggregate status as returned from isFieldAggregate()
 * @returns A React wrapped svg of the icon.
 */
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
    imageElement = numberAggregateIcon;
  } else {
    switch (fieldType) {
      case 'number':
        imageElement = numberIcon;
        break;
      case 'string':
        imageElement = stringIcon;
        break;
      case 'date':
      case 'timestamp':
        imageElement = timeIcon;
        break;
      case 'struct_base':
        imageElement = null;
        break;
      case 'struct_one_to_many':
        imageElement = oneToManyIcon;
        break;
      case 'struct_one_to_one':
        imageElement = oneToOneIcon;
        break;
      case 'struct_many_to_one':
        imageElement = manyToOneIcon;
        break;
      case 'boolean':
        imageElement = booleanIcon;
        break;
      case 'query':
        imageElement = queryIcon;
        break;
      default:
        imageElement = null;
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

@customElement('field-item')
export class FieldItem extends LitElement {
  static override styles = [styles];

  @property({type: Object}) field!: Field;
  @property({type: String}) path!: string;
  @property({}) onFieldClick?: (field: Field) => void;

  onClick = () => {
    this.onFieldClick?.(this.field);
  };

  render() {
    const clickable = this.onFieldClick ? 'clickable' : '';

    return html`<div
      class=${`field ${clickable}`}
      title=${buildTitle(this.field, this.path)}
      @click=${this.onClick}
    >
      ${getIconElement(fieldType(this.field), isFieldAggregate(this.field))}
      <span class="field_name">${this.field.name}</span>
    </div>`;
  }
}

@customElement('query-item')
export class QueryItem extends LitElement {
  static override styles = [styles];

  @property({type: Object}) query!: NamedQuery | QueryField;
  @property({type: String}) path!: string;
  @property({}) onQueryClick?: (query: NamedQuery | QueryField) => void;

  onClick = () => {
    this.onQueryClick?.(this.query);
  };

  render() {
    const clickable = this.onQueryClick ? 'clickable' : '';

    return html`<div class=${`field ${clickable}`} @click=${this.onClick}>
      ${getIconElement('query', false)}
      <span class="field_name">${this.query.name}</span>
    </div>`;
  }
}

@customElement('field-list')
export class FieldList extends LitElement {
  static override styles = [styles];

  @property({type: Object}) fields: Field[] = [];
  @property({type: String}) path!: string;
  @property({type: Function}) onFieldClick?: (field: Field) => void;
  @property({type: Function}) onQueryClick?: (
    query: NamedQuery | QueryField
  ) => void;

  render() {
    return html`<div class="field_list">
      ${this.fields.map(field =>
        field.isQuery()
          ? html`<query-item
              .query=${field}
              .onQueryClick=${this.onQueryClick}
            />`
          : html`<field-item
              .field=${field}
              .path=${this.path}
              .onFieldClick=${this.onFieldClick}
            />`
      )}
    </div>`;
  }
}

@customElement('struct-item')
export class StructItem extends LitElement {
  static override styles = [styles];

  @property({type: Object}) explore!: Explore;
  @property({type: String}) path!: string;
  @property({type: Function}) onFieldClick?: (field: Field) => void;
  @property({type: Function}) onQueryClick?: (
    query: NamedQuery | QueryField
  ) => void;
  @property({type: Function}) onPreviewClick?: (explore: Explore) => void;
  @property({type: Boolean}) hidden = false;

  toggleHidden = () => {
    this.hidden = !this.hidden;
  };

  onClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.onPreviewClick?.(this.explore);
  };

  render() {
    const subtype = exploreSubtype(this.explore);
    const {queries, dimensions, measures, explores} = bucketFields(
      this.explore.allFields
    );

    const buildPath = (explore: Explore, path: string) => {
      return `${path}${path ? '.' : ''}${explore.name}`;
    };

    return html`<li
      class="schema ${this.hidden ? 'hidden' : ''}"
      title=${buildTitle(this.explore, this.path)}
    >
      <div @click=${this.toggleHidden}>
        <span>${this.hidden ? '▶' : '▼'}</span>
        ${getIconElement(`struct_${subtype}`, false)}
        <b class="explore_name">${getExploreName(this.explore, this.path)}</b>
        ${this.onPreviewClick && !this.explore.hasParentExplore()
          ? html`<span class="preview" @click=${this.onClick}> Preview </span>`
          : null}
      </div>
      <ul>
        ${queries.length
          ? html`<li class="fields">
              <label>Queries</label>
              <field-list
                .fields=${queries}
                .path=${this.path}
                .onQueryClick=${this.onQueryClick}
              />
            </li>`
          : null}
        ${dimensions.length
          ? html`<li class="fields">
              <label>Dimensions</label>
              <field-list
                .fields=${dimensions}
                .path=${this.path}
                .onFieldClick=${this.onFieldClick}
              />
            </li>`
          : null}
        ${measures.length
          ? html`<li class="fields">
              <label>Measures</label>
              <field-list
                .fields=${measures}
                .path=${this.path}
                .onFieldClick=${this.onFieldClick}
              />
            </li>`
          : null}
        ${explores.length
          ? explores.map(
              explore =>
                html`<struct-item
                  .explore=${explore}
                  .path=${buildPath(explore, this.path)}
                  .onFieldClick=${this.onFieldClick}
                  .onPreviewClick=${this.onPreviewClick}
                  .onQueryClick=${this.onQueryClick}
                  ?hidden=${true}
                />`
            )
          : null}
      </ul>
    </li>`;
  }
}

@customElement('schema-renderer')
export class SchemaRenderer extends LitElement {
  static override styles = [styles];

  @property({type: Object}) explores: Explore[] = [];
  @property({type: Object}) queries: NamedQuery[] = [];
  @property({type: Function}) onFieldClick?: (field: Field) => void;
  @property({type: Function}) onQueryClick?: (
    query: NamedQuery | QueryField
  ) => void;
  @property({type: Function}) onPreviewClick?: (explore: Explore) => void;
  @property({type: Boolean}) defaultShow = false;

  render() {
    const hidden = !this.defaultShow;

    return html`<ul>
      <li>
        <div class="field_list">
          ${this.queries
            .sort(sortByName)
            .map(
              query =>
                html`<query-item
                  .query=${query}
                  .onQueryClick=${this.onQueryClick}
                />`
            )}
        </div>
      </li>
      ${this.explores
        .sort(sortByName)
        .map(
          explore =>
            html`<struct-item
              .explore=${explore}
              .path=${''}
              .onFieldClick=${this.onFieldClick}
              .onPreviewClick=${this.onPreviewClick}
              .onQueryClick=${this.onQueryClick}
              ?hidden=${hidden}
            />`
        )}
    </ul>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schema-renderer': SchemaRenderer;
    'struct-item': StructItem;
  }
}

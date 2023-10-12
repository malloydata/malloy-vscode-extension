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
import {classMap} from 'lit/directives/class-map.js';

import {styles} from './schema_renderer.css';
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

/**
 * Render a query item sub-element
 *
 * @param query Query item to render
 * @param onQueryClick Callback for query click
 * @returns Query item HTML fragment
 */
const queryItem = (
  query: NamedQuery | QueryField,
  onQueryClick?: (query: NamedQuery | QueryField) => void
) => {
  const onClick = () => {
    onQueryClick?.(query);
  };

  const clickable = onQueryClick ? 'clickable' : '';

  return html`<div class=${`field ${clickable}`} @click=${onClick}>
    ${getIconElement('query', false)}
    <span class="field_name">${query.name}</span>
  </div>`;
};

@customElement('struct-item')
export class StructItem extends LitElement {
  static override styles = [styles];

  @property({type: Object}) explore: Explore | null = null;
  @property({type: String}) path = '';
  @property() onFieldClick?: (field: Field) => void;
  @property() onQueryClick?: (query: NamedQuery | QueryField) => void;
  @property() onPreviewClick?: (explore: Explore) => void;
  @property({type: Boolean}) hidden = false;

  toggleHidden = () => {
    this.hidden = !this.hidden;
  };

  onClick = (event: MouseEvent) => {
    if (!this.explore) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.onPreviewClick?.(this.explore);
  };

  fieldItem(field: Field, path: string) {
    const onClick = () => {
      this.onFieldClick?.(field);
    };

    const clickable = this.onFieldClick ? 'clickable' : '';

    return html`<div
      class=${`field ${clickable}`}
      title=${buildTitle(field, path)}
      @click=${onClick}
    >
      ${getIconElement(fieldType(field), isFieldAggregate(field))}
      <span class="field_name">${field.name}</span>
    </div>`;
  }

  fieldList(fields: Field[], path: string) {
    return html`<div class="field_list">
      ${fields.map(field =>
        field.isQuery()
          ? queryItem(field, this.onQueryClick)
          : this.fieldItem(field, path)
      )}
    </div>`;
  }

  render() {
    const {explore, path} = this;
    if (!explore) {
      return;
    }
    const subtype = exploreSubtype(explore);
    const {queries, dimensions, measures, explores} = bucketFields(
      explore.allFields
    );

    const buildPath = (explore: Explore, path: string) => {
      return `${path}${path ? '.' : ''}${explore.name}`;
    };

    const classes = classMap({schema: true, hidden: this.hidden});

    return html`<li class=${classes} title=${buildTitle(explore, path)}>
      <div @click=${this.toggleHidden}>
        <span>${this.hidden ? '▶' : '▼'}</span>
        ${getIconElement(`struct_${subtype}`, false)}
        <b class="explore_name">${getExploreName(explore, path)}</b>
        ${this.onPreviewClick
          ? html`<span class="preview" @click=${this.onClick}> Preview </span>`
          : null}
      </div>
      <ul>
        ${queries.length
          ? html`<li class="fields">
              <label>Queries</label>
              ${this.fieldList(queries, path)}
            </li>`
          : null}
        ${dimensions.length
          ? html`<li class="fields">
              <label>Dimensions</label>
              ${this.fieldList(dimensions, path)}
            </li>`
          : null}
        ${measures.length
          ? html`<li class="fields">
              <label>Measures</label>
              ${this.fieldList(measures, path)}
            </li>`
          : null}
        ${explores.length
          ? explores.map(
              explore =>
                html`<struct-item
                  .explore=${explore}
                  .path=${buildPath(explore, path)}
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

  @property({type: Array}) explores: Explore[] = [];
  @property({type: Array}) queries: NamedQuery[] = [];
  @property() onFieldClick?: (field: Field) => void;
  @property() onQueryClick?: (query: NamedQuery | QueryField) => void;
  @property() onPreviewClick?: (explore: Explore) => void;
  @property({type: Boolean}) defaultShow = false;

  render() {
    const hidden = !this.defaultShow;

    return html`<ul>
      <li>
        <div class="field_list">
          ${this.queries
            .sort(sortByName)
            .map(query => queryItem(query, this.onQueryClick))}
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

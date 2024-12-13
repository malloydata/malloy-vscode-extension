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

import * as vscode from 'vscode';
import {URI, Utils} from 'vscode-uri';

import {
  ArrayDef,
  Explore,
  Field,
  QueryField,
  AtomicField,
  DocumentLocation,
} from '@malloydata/malloy';
import {BaseLanguageClient} from 'vscode-languageclient';
import {BuildModelRequest} from '../../common/types/file_handler';
import {
  exploreSubtype,
  fieldType,
  getTypeLabel,
  getTypeLabelFromStructDef,
  isFieldAggregate,
  isFieldHidden,
} from '../../common/schema';
import {FetchModelMessage} from '../../common/types/message_types';
import {WorkerConnection} from '../worker_connection';
import {getActiveDocumentMetadata} from '../commands/utils/run_query_utils';
import {DocumentMetadata} from '../../common/types/query_spec';

const arrayIcon = 'data-type-array.svg';
const numberIcon = 'number.svg';
const numberAggregateIcon = 'number-aggregate.svg';
const booleanIcon = 'boolean.svg';
const timeIcon = 'time.svg';
const structIcon = 'struct.svg';
const queryIcon = 'turtle.svg';
const stringIcon = 'string.svg';
const oneToManyIcon = 'one_to_many.svg';
const manyToOneIcon = 'many_to_one.svg';
const oneToOneIcon = 'one_to_one.svg';
const unknownIcon = 'unknown.svg';
const sqlDatabaseIcon = 'sql-database.svg';

export class SchemaProvider
  implements vscode.TreeDataProvider<ArrayItem | ExploreItem | FieldItem>
{
  private readonly resultCache: Map<string, ExploreItem[]>;
  private previousKey: string | undefined;
  private refreshSchemaCache = false;

  constructor(
    private context: vscode.ExtensionContext,
    private client: BaseLanguageClient,
    private worker: WorkerConnection
  ) {
    this.resultCache = new Map();
  }

  getTreeItem(element: ExploreItem): vscode.TreeItem {
    return element;
  }

  private _onDidChangeTreeData: vscode.EventEmitter<
    (ExploreItem | FieldItem) | undefined
  > = new vscode.EventEmitter<(ExploreItem | FieldItem) | undefined>();

  readonly onDidChangeTreeData: vscode.Event<
    (ExploreItem | FieldItem) | undefined
  > = this._onDidChangeTreeData.event;

  async refresh(refreshSchemaCache?: boolean): Promise<void> {
    this.refreshSchemaCache = refreshSchemaCache || false;
    this._onDidChangeTreeData.fire(undefined);
  }

  async getStructs({
    uri,
    version,
    languageId,
  }: DocumentMetadata): Promise<Explore[] | undefined> {
    try {
      const request: BuildModelRequest = {
        uri,
        version,
        languageId,
        refreshSchemaCache: this.refreshSchemaCache,
      };
      const model: FetchModelMessage = await this.client.sendRequest(
        'malloy/fetchModel',
        request
      );
      const explores = model.explores.map(explore => Explore.fromJSON(explore));
      return explores.sort(exploresByName);
    } catch (error) {
      return undefined;
    }
  }

  async getChildren(
    element?: ExploreItem
  ): Promise<(ArrayItem | ExploreItem | FieldItem)[]> {
    if (element) {
      return element.explore.allFields
        .filter(field => !isFieldHidden(field))
        .sort(byKindThenName)
        .map(field => {
          const newPath = [...element.accessPath, field.name];
          if (field.isExploreField()) {
            if (field.structDef.type === 'array') {
              return new ArrayItem(
                this.context,
                element.topLevelExplore,
                field.structDef,
                newPath,
                field.location
              );
            } else {
              return new ExploreItem(
                this.context,
                element.topLevelExplore,
                field,
                newPath,
                element.explore.location,
                element.explore.allFields.length === 1
              );
            }
          } else {
            return new FieldItem(
              this.context,
              element.topLevelExplore,
              field,
              newPath,
              field.location
            );
          }
        });
    } else {
      const documentMeta = getActiveDocumentMetadata();
      if (!documentMeta) {
        return [];
      }
      const {uri} = documentMeta;
      const cacheKey = uri;

      if (this.previousKey !== cacheKey) {
        this.previousKey = cacheKey;
        await this.refresh();
        return this.resultCache.get(cacheKey) || [];
      }

      const explores = await this.getStructs(documentMeta);
      this.refreshSchemaCache = false;
      if (explores === undefined) {
        return this.resultCache.get(cacheKey) || [];
      } else {
        const results = explores.map(
          explore =>
            new ExploreItem(
              this.context,
              explore.name,
              explore,
              [],
              explore.location,
              explores.length === 1
            )
        );
        this.resultCache.set(cacheKey, results);
        return results;
      }
    }
  }
}

class ExploreItem extends vscode.TreeItem {
  constructor(
    private context: vscode.ExtensionContext,
    public topLevelExplore: string,
    public explore: Explore,
    public accessPath: string[],
    public location: DocumentLocation | undefined,
    open: boolean
  ) {
    super(
      explore.name,
      open
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.contextValue = 'explore';
    this.tooltip = explore.name;

    const subtype = exploreSubtype(explore);

    this.iconPath = {
      light: getIconPath(this.context, `struct_${subtype}`, false),
      dark: getIconPath(this.context, `struct_${subtype}`, false),
    };
  }
}

class ArrayItem extends vscode.TreeItem {
  constructor(
    private context: vscode.ExtensionContext,
    public topLevelExplore: string,
    public arrayDef: ArrayDef,
    public accessPath: string[],
    public location: DocumentLocation | undefined
  ) {
    super(arrayDef.as || arrayDef.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'array';
    const typeLabel = getTypeLabelFromStructDef(arrayDef);
    this.tooltip = new vscode.MarkdownString(
      `
$(symbol-field) \`${this.label}\`

**Path**: \`${this.accessPath.join('.')}\`

**Type**: \`${typeLabel}\`
    `,
      true
    );
  }

  override iconPath = {
    light: getIconPath(this.context, 'array', false),
    dark: getIconPath(this.context, 'array', false),
  };
}

export class FieldItem extends vscode.TreeItem {
  constructor(
    private context: vscode.ExtensionContext,
    public topLevelExplore: string,
    public field: AtomicField | QueryField,
    public accessPath: string[],
    public location: DocumentLocation | undefined
  ) {
    super(field.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = fieldType(this.field);
    const typeLabel = getTypeLabel(this.field);
    this.tooltip = new vscode.MarkdownString(
      `
$(symbol-field) \`${field.name}\`

**Path**: \`${this.accessPath.join('.')}\`

**Type**: \`${typeLabel}\`
    `,
      true
    );
  }

  override iconPath = {
    light: getIconPath(
      this.context,
      fieldType(this.field),
      isFieldAggregate(this.field)
    ),
    dark: getIconPath(
      this.context,
      fieldType(this.field),
      isFieldAggregate(this.field)
    ),
  };
}

function getIconPath(
  context: vscode.ExtensionContext,
  fieldType: string,
  isAggregate: boolean
): URI {
  let imageFileName: string;
  if (isAggregate) {
    imageFileName = numberAggregateIcon;
  } else {
    switch (fieldType) {
      case 'number':
        imageFileName = numberIcon;
        break;
      case 'string':
        imageFileName = stringIcon;
        break;
      case 'date':
      case 'timestamp':
        imageFileName = timeIcon;
        break;
      case 'struct_base':
        imageFileName = structIcon;
        break;
      case 'struct_one_to_many':
        imageFileName = oneToManyIcon;
        break;
      case 'struct_one_to_one':
        imageFileName = oneToOneIcon;
        break;
      case 'struct_many_to_one':
        imageFileName = manyToOneIcon;
        break;
      case 'boolean':
        imageFileName = booleanIcon;
        break;
      case 'query':
        imageFileName = queryIcon;
        break;
      case 'array':
        imageFileName = arrayIcon;
        break;
      case 'sql native':
        imageFileName = sqlDatabaseIcon;
        break;
      default:
        imageFileName = unknownIcon;
    }
  }

  const uri = context.extensionUri;
  return Utils.joinPath(uri, 'img', imageFileName);
}

function byKindThenName(field1: Field, field2: Field) {
  const kind1 = kindOrd(field1);
  const kind2 = kindOrd(field2);
  if (kind1 === kind2) {
    const name1 = field1.name;
    const name2 = field2.name;
    if (name1 < name2) {
      return -1;
    }
    if (name2 < name1) {
      return 1;
    }
    return 0;
  }
  return kind1 - kind2;
}

function kindOrd(field: Field) {
  if (field.isQueryField()) {
    return 0;
  }
  if (field.isExploreField()) {
    return 4;
  }
  if (field.isAtomicField() && field.isCalculation()) {
    return 2;
  }
  return 1;
}

function exploresByName(struct1: Explore, struct2: Explore) {
  if (struct1.name < struct2.name) {
    return -1;
  }
  if (struct2.name < struct1.name) {
    return 1;
  }
  return 0;
}

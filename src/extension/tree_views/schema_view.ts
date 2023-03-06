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
import {Utils} from 'vscode-uri';

import {
  Explore,
  Runtime,
  JoinRelationship,
  Field,
  QueryField,
  AtomicField,
  URLReader,
} from '@malloydata/malloy';
import numberIcon from '../../media/number.svg';
import numberAggregateIcon from '../../media/number-aggregate.svg';
import booleanIcon from '../../media/boolean.svg';
import timeIcon from '../../media/time.svg';
import structIcon from '../../media/struct.svg';
import queryIcon from '../../media/turtle.svg';
import stringIcon from '../../media/string.svg';
import oneToManyIcon from '../../media/one_to_many.svg';
import manyToOneIcon from '../../media/many_to_one.svg';
import oneToOneIcon from '../../media/one_to_one.svg';
import {MALLOY_EXTENSION_STATE} from '../state';
import {ConnectionManager} from '../../common/connection_manager';

export class SchemaProvider
  implements vscode.TreeDataProvider<ExploreItem | FieldItem>
{
  private readonly resultCache: Map<string, ExploreItem[]>;
  private previousKey: string | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private connectionManager: ConnectionManager,
    private urlReader: URLReader
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

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async getChildren(
    element?: ExploreItem
  ): Promise<(ExploreItem | FieldItem)[]> {
    if (element) {
      return element.explore.allFields.sort(byKindThenName).map(field => {
        const newPath = [...element.accessPath, field.name];
        if (field.isExploreField()) {
          return new ExploreItem(
            this.context,
            element.topLevelExplore,
            field,
            newPath,
            element.explore.allFields.length === 1
          );
        } else {
          return new FieldItem(
            this.context,
            element.topLevelExplore,
            field,
            newPath
          );
        }
      });
    } else {
      const document =
        vscode.window.activeTextEditor?.document ||
        MALLOY_EXTENSION_STATE.getActiveWebviewPanel()?.document;

      if (document === undefined) {
        return [];
      }

      const cacheKey = document.uri.toString();

      if (this.previousKey !== cacheKey) {
        this.previousKey = cacheKey;
        this.refresh();
        return this.resultCache.get(cacheKey) || [];
      }

      const explores = await getStructs(
        this.connectionManager,
        this.urlReader,
        document
      );
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
              explores.length === 1
            )
        );
        this.resultCache.set(cacheKey, results);
        return results;
      }
    }
  }
}

async function getStructs(
  connectionManager: ConnectionManager,
  reader: URLReader,
  document: vscode.TextDocument
): Promise<Explore[] | undefined> {
  const url = new URL(document.uri.toString());
  try {
    const runtime = new Runtime(
      reader,
      connectionManager.getConnectionLookup(url)
    );
    const model = await runtime.getModel(url);

    return Object.values(model.explores).sort(exploresByName);
  } catch (error) {
    return undefined;
  }
}

class ExploreItem extends vscode.TreeItem {
  constructor(
    private context: vscode.ExtensionContext,
    public topLevelExplore: string,
    public explore: Explore,
    public accessPath: string[],
    open: boolean
  ) {
    super(
      explore.name,
      open
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.tooltip = explore.name;

    let subtype;
    if (explore.hasParentExplore()) {
      const relationship = explore.joinRelationship;
      subtype =
        relationship === JoinRelationship.ManyToOne
          ? 'many_to_one'
          : relationship === JoinRelationship.OneToMany
          ? 'one_to_many'
          : JoinRelationship.OneToOne
          ? 'one_to_one'
          : 'base';
    } else {
      subtype = 'base';
    }

    this.iconPath = {
      light: getIconPath(this.context, `struct_${subtype}`, false),
      dark: getIconPath(this.context, `struct_${subtype}`, false),
    };
  }
}

class FieldItem extends vscode.TreeItem {
  constructor(
    private context: vscode.ExtensionContext,
    public topLevelExplore: string,
    public field: AtomicField | QueryField,
    public accessPath: string[]
  ) {
    super(field.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = this.type();
    this.tooltip = new vscode.MarkdownString(
      `
$(symbol-field) \`${field.name}\`

**Path**: \`${this.accessPath.join('.')}\`

**Type**: \`${this.type()}\`
    `,
      true
    );
  }

  command = {
    title: 'Copy Field path',
    command: 'malloy.copyFieldPath',
    arguments: [this.accessPath.join('.')],
  };

  iconPath = {
    light: getIconPath(this.context, this.type(), this.isAggregate()),
    dark: getIconPath(this.context, this.type(), this.isAggregate()),
  };

  isAggregate() {
    return this.field.isAtomicField() && this.field.isCalculation();
  }

  type() {
    return this.field.isAtomicField() ? this.field.type.toString() : 'query';
  }
}

function getIconPath(
  context: vscode.ExtensionContext,
  fieldType: string,
  isAggregate: boolean
) {
  let imageFileName;
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
      default:
        imageFileName = 'unknown';
    }
  }

  const uri = context.extensionUri;
  return Utils.joinPath(uri, 'dist', imageFileName);
}

export function runTurtleFromSchemaCommand(fieldItem: FieldItem): void {
  vscode.commands.executeCommand(
    'malloy.runQuery',
    `query: ${fieldItem.topLevelExplore}->${fieldItem.accessPath.join('.')}`,
    `${fieldItem.topLevelExplore}->${fieldItem.accessPath.join('.')}`
  );
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

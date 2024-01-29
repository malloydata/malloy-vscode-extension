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
import {MalloySQLParser, MalloySQLStatementType} from '@malloydata/malloy-sql';
import {CellMetadata} from '../../common/types/file_handler';

interface NotebookMetadata {
  initialComments?: string | undefined;
}

export function activateNotebookSerializer(context: vscode.ExtensionContext) {
  if (!vscode.notebooks) {
    return;
  }

  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer(
      'malloy-notebook',
      new MalloySerializer()
    )
  );
}

const languageIdFromStatementType = (type: MalloySQLStatementType) => {
  switch (type) {
    case MalloySQLStatementType.MALLOY:
      return 'malloy';
    case MalloySQLStatementType.SQL:
      return 'malloy-sql';
    case MalloySQLStatementType.MARKDOWN:
      return 'markdown';
  }
};

const kindFromStatementType = (type: MalloySQLStatementType) => {
  if (type === MalloySQLStatementType.MARKDOWN) {
    return vscode.NotebookCellKind.Markup;
  } else {
    return vscode.NotebookCellKind.Code;
  }
};

const statementTypeFromLanguageIdAndKind = (
  language: string,
  kind: vscode.NotebookCellKind
) => {
  if (kind === vscode.NotebookCellKind.Markup) {
    return MalloySQLStatementType.MARKDOWN;
  } else {
    if (language === 'malloy-sql') {
      return MalloySQLStatementType.SQL;
    } else {
      return MalloySQLStatementType.MALLOY;
    }
  }
};

interface RawNotebookCell {
  language: string;
  value: string;
  kind: vscode.NotebookCellKind;
  metadata?: {[key: string]: unknown};
}

class MalloySerializer implements vscode.NotebookSerializer {
  async deserializeNotebook(
    content: Uint8Array,
    _token: vscode.CancellationToken
  ): Promise<vscode.NotebookData> {
    const contents = new TextDecoder().decode(content);
    let raw: RawNotebookCell[] = [];
    const metadata: NotebookMetadata = {};

    if (contents.length === 0) {
      raw = []; // Handle empty (new) notebook
    } else if (contents.startsWith('[')) {
      raw = <RawNotebookCell[]>JSON.parse(contents);
    } else {
      const parsed = MalloySQLParser.parse(contents);
      metadata.initialComments = parsed.initialComments;
      for (const statement of parsed.statements) {
        const {config, type} = statement;
        let {text} = statement;
        if (config?.fromDelimiter && config?.connection) {
          text = `-- connection: ${config?.connection}\n\n` + text;
        }
        const cell: RawNotebookCell = {
          language: languageIdFromStatementType(type),
          value: text.replaceAll(/^\\/gm, ''),
          kind: kindFromStatementType(type),
        };
        const metadata: CellMetadata = {
          config: {},
        };
        if (config?.connection && !config.inheritedConnection) {
          metadata.config = {connection: config.connection};
        }
        cell.metadata = metadata;
        raw.push(cell);
      }
    }

    const cells = raw.map(item => {
      const cell = new vscode.NotebookCellData(
        item.kind,
        item.value,
        item.language
      );
      if (item.metadata) {
        cell.metadata = item.metadata;
      }
      return cell;
    });

    const notebook = new vscode.NotebookData(cells);
    notebook.metadata = metadata;
    return notebook;
  }

  async serializeNotebook(
    {metadata, cells}: vscode.NotebookData,
    _token: vscode.CancellationToken
  ): Promise<Uint8Array> {
    let malloySql = '';
    if (metadata) {
      const {initialComments} = metadata as NotebookMetadata;
      if (initialComments) {
        malloySql = initialComments;
      }
    }

    for (const cell of cells) {
      if (malloySql.length && !malloySql.endsWith('\n')) {
        malloySql += '\n';
      }
      const {kind, languageId, value} = cell;
      const statementType = statementTypeFromLanguageIdAndKind(
        languageId,
        kind
      );
      const separator = `>>>${statementType}`;
      malloySql += `${separator}\n${value.replaceAll(/^([>\\])/gm, '\\$1')}`;
    }

    return new TextEncoder().encode(malloySql);
  }
}

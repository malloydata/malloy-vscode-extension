/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
      new MalloySerializer(),
      {
        transientCellMetadata: {cost: true, config: true},
        transientDocumentMetadata: {},
        transientOutputs: true,
      }
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
    default:
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
      if (value) {
        malloySql += `${separator}\n${value.replaceAll(/^([>\\])/gm, '\\$1')}`;
      } else {
        malloySql += `${separator}\n\n`;
      }
    }

    return new TextEncoder().encode(malloySql);
  }
}

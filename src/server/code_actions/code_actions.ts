import {
  CodeAction,
  CodeActionKind,
  Command,
  Range,
} from 'vscode-languageserver';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {TranslateCache} from '../translate_cache';
import {LogMessage, MalloyError} from '@malloydata/malloy';

export async function getMalloyCodeAction(
  translateCache: TranslateCache,
  document: TextDocument,
  range: Range
): Promise<(CodeAction | Command)[] | null> {
  const problems: LogMessage[] = [];
  try {
    const model = await translateCache.translateWithCache(
      document.uri,
      document.version,
      document.languageId
    );
    if (model?.problems) {
      problems.push(...model.problems);
    }
  } catch (error) {
    if (error instanceof MalloyError) {
      problems.push(...error.problems);
    }
  }
  const actions: CodeAction[] = [];
  for (const problem of problems) {
    if (problem.at?.range) {
      const par = problem.at.range;
      if (
        par.start.line === range.start.line &&
        par.start.character === range.start.character &&
        par.end.line === range.end.line &&
        par.end.character === range.end.character &&
        problem.replacement
      ) {
        const edit = {
          changes: {
            [document.uri]: [
              {
                range,
                newText: problem.replacement,
              },
            ],
          },
        };
        const codeAction: CodeAction = {
          title: `Replace with ${problem.replacement}`,
          kind: CodeActionKind.QuickFix,
          edit,
        };
        actions.push(codeAction);
      }
    }
  }
  return actions;
}

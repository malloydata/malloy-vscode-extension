import {MalloySQLParser} from '@malloydata/malloy-sql';
import {
  CodeLensProvider,
  TextDocument,
  CodeLens,
  Command,
  Range,
  Position,
} from 'vscode';

export class MSQLLensProvider implements CodeLensProvider {
  async provideCodeLenses(document: TextDocument): Promise<CodeLens[]> {
    // TODO cache doc
    // TODO check for doc
    const statements = new MalloySQLParser().parse(document.getText());

    const start = new Range(0, 0, 0, 0);

    const runAll: Command = {
      command: 'malloy.runMalloySQLFile',
      title: 'Run All Statements',
    };

    const compileSQLAll: Command = {
      command: 'malloy.showSQLMalloySQLFile',
      title: 'Compile All Statements',
    };

    const lenses: CodeLens[] = [];
    for (const statement of statements) {
      lenses.push(
        new CodeLens(
          new Range(
            new Position(
              statement.controlLineLocation.start.line,
              statement.controlLineLocation.start.column
            ),
            new Position(
              statement.controlLineLocation.end.line,
              statement.controlLineLocation.end.column
            )
          ),
          {
            command: 'malloy.runMalloySQLStatement',
            title: 'Run',
            arguments: [statement.statementIndex],
          }
        )
      );
    }

    return [
      new CodeLens(start, runAll),
      new CodeLens(start, compileSQLAll),
      ...lenses,
    ];
  }
}

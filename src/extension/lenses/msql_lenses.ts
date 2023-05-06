import {CodeLensProvider, TextDocument, CodeLens, Command, Range} from 'vscode';

export class MSQLLensProvider implements CodeLensProvider {
  async provideCodeLenses(document: TextDocument): Promise<CodeLens[]> {
    const start = new Range(0, 0, 0, 0);

    const runAll: Command = {
      command: 'malloy.runMalloySQLFile',
      title: 'Run All Statements',
    };

    const compileSQLAll: Command = {
      command: 'malloy.showSQLMalloySQLFile',
      title: 'Compile All Statements',
    };

    return [new CodeLens(start, runAll), new CodeLens(start, compileSQLAll)];
  }
}

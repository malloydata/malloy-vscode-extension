/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {notebookCellToFileURL} from '../../src/common/connection_manager';

// Regression test for the notebook-cell config-discovery bug. Before this
// helper existed, getConfigForFile was called with the cell URI; discoverConfig
// walked up using `vscode-notebook-cell:` URLs that nothing can serve, so every
// notebook fell through to the defaults-only fallback and silently lost every
// connection defined in the workspace's `malloy-config.json`. The user-visible
// symptom was "cell N can't see definitions from cells before it" — really it
// was "no cell can talk to its database, so any source backed by a configured
// connection failed to compile, leaving its symbols undefined for the chain."
// Notebook chaining and connection discovery look unrelated; they're not.
// See `src/extension/notebook/CONTEXT.md` ("How Cell Chaining Works", contract #5).
describe('notebookCellToFileURL', () => {
  const desktopRoot = new URL('file:///Users/mtoy/malloy-imdb/');

  it('converts a vscode-notebook-cell URI to a file URI under a desktop workspace', () => {
    const cell = new URL(
      'vscode-notebook-cell:/Users/mtoy/malloy-imdb/imdb.malloynb#W5sZmlsZQ%3D%3D'
    );
    const result = notebookCellToFileURL(cell, [desktopRoot]);
    expect(result.toString()).toBe(
      'file:///Users/mtoy/malloy-imdb/imdb.malloynb'
    );
    expect(result.hash).toBe('');
  });

  it('borrows the scheme from a matching vscode-vfs workspace root', () => {
    const vfsRoot = new URL('vscode-vfs://github/malloydata/malloy/');
    const cell = new URL(
      'vscode-notebook-cell://github/malloydata/malloy/notebook.malloynb#W5s'
    );
    const result = notebookCellToFileURL(cell, [vfsRoot]);
    expect(result.toString()).toBe(
      'vscode-vfs://github/malloydata/malloy/notebook.malloynb'
    );
  });

  it('falls back to file: scheme when no workspace root matches', () => {
    const cell = new URL('vscode-notebook-cell:/tmp/loose.malloynb#frag');
    const result = notebookCellToFileURL(cell, [desktopRoot]);
    expect(result.toString()).toBe('file:///tmp/loose.malloynb');
  });

  it('leaves non-cell URIs unchanged', () => {
    const fileURL = new URL('file:///Users/mtoy/malloy-imdb/imdb.malloy');
    expect(notebookCellToFileURL(fileURL, [desktopRoot])).toBe(fileURL);

    const untitled = new URL('untitled:/Untitled-1');
    expect(notebookCellToFileURL(untitled, [desktopRoot])).toBe(untitled);
  });

  it('handles workspace roots with or without trailing slashes', () => {
    const noSlashRoot = new URL('file:///Users/mtoy/malloy-imdb');
    const cell = new URL(
      'vscode-notebook-cell:/Users/mtoy/malloy-imdb/imdb.malloynb#frag'
    );
    const result = notebookCellToFileURL(cell, [noSlashRoot]);
    expect(result.toString()).toBe(
      'file:///Users/mtoy/malloy-imdb/imdb.malloynb'
    );
  });
});

# Notebook — Malloy Notebooks

Support for `.malloynb` files — interactive notebooks combining Malloy code, SQL, and results.

## Key Concepts

- Notebooks use a custom JSON format (not Jupyter `.ipynb`)
- Each cell is Malloy code, Malloy-SQL, or markdown
- Cells are **chained**: a cell sees every prior code cell's definitions, as if they were one document
- Per-cell `malloy:` metadata can override connection settings

## How Cell Chaining Works

Cell N never compiles in isolation. Every time the language server compiles cell N (for diagnostics, completions, hover, code actions, lenses), it rebuilds the chain from scratch. There is no per-notebook cached chained model.

### The chain

`TranslateCache.createModelMaterializer` in `src/server/translate_cache.ts` is the entry point. When it sees a `vscode-notebook-cell:` URI it:

1. **Asks for the cell list.** `getCellData(cellN.uri)` → RPC `malloy/fetchCellData` → the extension's `fetchCellData` in `src/extension/utils/files.ts`. That iterates `notebook.getCells()` in document order and returns every code cell **up to and including** cell N.
2. **Walks the list.** First code cell: `runtime.loadModel(cell0.uri, …)`. Every subsequent cell: `modelMaterializer.extendModel(cellK.uri, …)`. The Malloy compiler dereferences each URL, fetches that cell's text, and layers its definitions onto the materializer.
3. **Returns the chained model.** `noThrowOnError: true` is set, so a broken earlier cell does **not** throw — its problems show up in the returned model's `problems` array. A silent compile failure in cell K shows up as cell N "not seeing" cell K's definitions.

`importBaseURL` is the notebook's own URI (or, for `untitled:` notebooks, the workspace folder), so relative `import "..."` resolves against the notebook directory, not against the cell URI.

### How cell text gets resolved

Steps 2 and 3 above need to read the text of every cell in the chain. That goes through `urlReader.readURL` → `TranslateCache.getDocumentText` (`src/server/translate_cache.ts`). It tries two paths in order:

1. **LSP cache (fast).** `documents.get(uri.toString())`. The LSP only knows about cells that were sent to it via didOpen. The LSP client registers notebook cells in its `documentSelector` in `src/extension/node/extension_node.ts` and `src/extension/browser/extension_browser.ts`:

   ```ts
   {language: 'malloy',     notebook: {notebookType: 'malloy-notebook', scheme: '*'}},
   {language: 'malloy-sql', notebook: {notebookType: 'malloy-notebook', scheme: '*'}},
   ```

   Remove either entry and cells of that language stop arriving at the LSP — every read for them falls through to path 2, and any breakage of path 2 then breaks the chain.

2. **RPC fallback.** `malloy/fetchFile` → extension `fetchFile` in `src/extension/utils/files.ts`. The `notebookCellDocument` helper resolves the cell URL to the live cell document (`notebook.uri.path === uri.path`, then `cell.document.uri.fragment === uri.fragment`) and returns its text. **Do not** let `vscode-notebook-cell:` URIs fall through to `workspace.fs.readFile`; that reads the whole notebook container, not the cell, and silently breaks the chain.

The same `fetchFile` is also reached from the worker (cell execution path) via the `malloy/fetch` RPC, so it is the single chokepoint for any cross-cell read that is not in the LSP cache.

### Cell URI shape

`vscode-notebook-cell:/<path-to-notebook>#<fragment>`. The path matches the underlying notebook file's path; the fragment uniquely identifies the cell within the notebook. `fetchCellData` and `notebookCellDocument` both depend on this — they look up the notebook by `path` and the cell by `fragment`.

### Contracts to preserve

These five invariants together produce "cells feel like one document". Break any one and cross-cell references silently fail:

| # | Contract | Lives in | If broken |
|---|---|---|---|
| 1 | LSP `documentSelector` includes notebook cell entries for every cell language | `extension_node.ts`, `extension_browser.ts` | Cells aren't synced to LSP; every read goes via RPC |
| 2 | `fetchCellData` returns code cells in document order, up through the requested cell | `utils/files.ts` | Wrong/short chain — earlier cells invisible |
| 3 | `fetchFile` resolves `vscode-notebook-cell:` URIs to live cell text, never to the notebook container | `utils/files.ts` (`notebookCellDocument`) | For a cell URI not already in `vscode.workspace.textDocuments`, fetchFile falls through to `workspace.fs.readFile` and returns the whole notebook JSON in place of cell text — chain breaks silently. Most likely to bite on the worker / Run-cell path, which has no LSP `documents` cache to mask the gap. |
| 4 | `createModelMaterializer` walks every code cell up to the target with `loadModel` then `extendModel` | `server/translate_cache.ts` | Cell N can't see definitions from cells 0..N-1 |
| 5 | Cell URIs are normalized to the notebook file URI before connection-config resolution | `common/connection_manager.ts` (`notebookCellToFileURL`) | Config discovery walks up using `vscode-notebook-cell:` URLs that nothing can serve, so every cell falls through to the defaults-only fallback — connections defined in `malloy-config.json` vanish, sources fail to compile, the chain shows a confusing "undefined object" error in cell N |

Contract #5 is non-obvious: connection resolution and cell chaining look unrelated, but a cell URI fed to `discoverConfig` walks up using `vscode-notebook-cell:` URLs that nothing can serve, so config silently falls back to defaults. The chain itself is fine; every cell just can't reach its database. See `src/common/connections/CONTEXT.md` ("Notebook Cell URIs").

Regression tests: `test/extension/files.spec.ts` (#3), `test/common/connection_manager.spec.ts` (#5).

## Files

### `malloy_controller.ts`
`MalloyNotebookController` — implements VS Code's `NotebookController` API:
- Handles cell execution requests
- Compiles and runs Malloy code in cells
- Manages cell execution order and cancellation
- Surfaces renderer validation errors (from `viz.getLogs()`) in the VS Code Problems pane via `setRenderDiagnostics`
- Passes cell URI through output metadata (`cellUri`) so the renderer can identify the source cell
- Clears render diagnostics on cell re-execution, cell deletion, and notebook close

### `malloy_serializer.ts`
`MalloyNotebookSerializer` — implements `NotebookSerializer`:
- Serializes/deserializes `.malloynb` files
- Custom JSON format with cell array, metadata, outputs

### `types.ts`
Notebook-specific type definitions.

### `renderer/`
Custom notebook output renderers:
- `malloy_entry.tsx` — renders query results in notebook cells; posts `malloy.renderLogs` messages back to the extension host with render validation logs
- `MalloyRenderer.tsx` — result display component
- `schema_entry.tsx` — renders schema output in notebook cells

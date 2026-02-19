# Notebook — Malloy Notebooks

Support for `.malloynb` files — interactive notebooks combining Malloy code, SQL, and results.

## Key Concepts

- Notebooks use a custom JSON format (not Jupyter `.ipynb`)
- Each cell can be Malloy code or markdown
- Cells are **chained**: each cell's model extends the previous cell's compiled model
- Per-cell `malloy:` metadata can override connection settings

## Files

### `malloy_controller.ts`
`MalloyNotebookController` — implements VS Code's `NotebookController` API:
- Handles cell execution requests
- Compiles and runs Malloy code in cells
- Manages cell execution order and cancellation

### `malloy_serializer.ts`
`MalloyNotebookSerializer` — implements `NotebookSerializer`:
- Serializes/deserializes `.malloynb` files
- Custom JSON format with cell array, metadata, outputs

### `types.ts`
Notebook-specific type definitions.

### `renderer/`
Custom notebook output renderers:
- `malloy_entry.tsx` — renders query results in notebook cells
- `MalloyRenderer.tsx` — result display component
- `schema_entry.tsx` — renders schema output in notebook cells

## Cell URI Scheme

Notebook cells use `vscode-notebook-cell:` URIs (e.g., `file.malloynb#W5s...`). The language server's `TranslateCache` handles these specially, chaining models from previous cells.

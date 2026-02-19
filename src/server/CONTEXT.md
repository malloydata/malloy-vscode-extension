# Server — Language Server

Runs in a separate process. Implements the Language Server Protocol for Malloy files.

## Entry Points

- `node/server_node.ts` — Node.js: creates IPC connection, `NodeConnectionFactory`, `NodeMessageHandler`
- `browser/server_browser.ts` — Browser: creates worker-based connection, `WebConnectionFactory`

Both delegate to `init.ts` for common setup.

## Core Files

### `init.ts` — Server Orchestrator
Registers all LSP handlers:
- `onInitialize` — declares server capabilities
- `onDocumentSymbol`, `onCodeLens`, `onCompletion`, `onCompletionResolve`
- `onHover`, `onDefinition`, `onCodeAction`
- Custom: `malloy/findLensesAt`, `malloy/getConnectionTypeInfo`

Document lifecycle:
- Tracks open documents via `TextDocuments`
- `onDidChangeContent` triggers debounced diagnostics (300ms delay)
- `onDidClose` cleans up caches
- Dependency tracking: changes to imported files cascade diagnostics to importers

### `translate_cache.ts` — Model Compilation Cache
- `translateWithCache(uri)` — compiles Malloy to validated model, caches by URI
- Creates ephemeral `Runtime` per operation with connection lookups
- Tracks import dependency graph for cascading invalidation
- Notebook support: chains cell models (`vscode-notebook-cell:` URIs)
- `translateWithTruncatedCache()` — partial compilation for fast schema completions

### `parse_cache.ts` — Syntax Parse Cache
Fast parsing without compilation. Used by hover, symbols, lenses, completions.
- `parseWithCache()`, `parseMalloySQLWithCache()`, `parseMalloySQLSQLWithCache()`
- Invalidated per document version

## LSP Features (subdirectories)

| Directory | Feature | Needs compilation? |
|-----------|---------|-------------------|
| `completions/` | Autocomplete (keywords + schema fields) | Partial (truncated) |
| `diagnostics/` | Error/warning reporting | Yes |
| `hover/` | Hover documentation | No (parse only) |
| `definitions/` | Go-to-definition, import navigation | Yes |
| `symbols/` | Document outline / symbol tree | No (parse only) |
| `lenses/` | Run buttons, table links (CodeLens) | Yes |
| `code_actions/` | Quick fixes | Yes |

### Completions Detail
Two modes in `completions/`:
- `completions.ts` — keyword completions from syntax context
- `schema_completions.ts` — field/explore completions from compiled schema

Uses `translateWithTruncatedCache()` to avoid full compilation for responsiveness.

### Lenses Detail
`lenses/lenses.ts` generates:
- **Run buttons** for explores and named queries
- **Table links** to external UIs (BigQuery console, etc.) via `getSourceUrl()` from connections

## Connections

Platform-specific `ConnectionFactory` implementations:
- `connections/node/connection_factory.ts` — Node.js: reads config files from disk, registers backends via side-effect imports
- `connections/browser/connection_factory.ts` — Browser: limited, no file system access

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
- Creates an ephemeral `Runtime` per operation via the private `makeRuntime` factory; each call site wraps the operation in a `try`/`finally` and calls `idleRuntime(runtime)` on the way out — the "op done" boundary the connection layer uses for cleanup. For DuckDB with `shareable: true` configured (malloy ≥ 0.0.391), this is where the file lock is released between language-server compiles; under the default mode it's effectively a no-op for the lock. See `src/common/connections/CONTEXT.md` ("Per-Operation Idle").
- Tracks import dependency graph for cascading invalidation
- Notebook support: `createModelMaterializer` chains cell models (`loadModel` then `extendModel` over every prior code cell). Full mechanism documented in `src/extension/notebook/CONTEXT.md` ("How Cell Chaining Works").
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
- `connections/browser/connection_factory.ts` — Browser: implements `postProcessConnection` to register `remoteTableCallback` on DuckDB WASM connections, enabling file fetching (CSV, Parquet) via the extension host's `malloy/fetchBinaryFile` RPC

`findMalloyConfig` in the Node factory walks up from the file's directory to the workspace root boundary, using the first `malloy-config.json` found. The global config directory is only used as a fallback when no workspace config exists — it is never merged with workspace config.

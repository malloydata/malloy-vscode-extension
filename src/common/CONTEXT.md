# Common — Shared Code

Used by extension host, language server, and worker. Must be browser-safe.

## Connection Management

### `connection_manager.ts`
Central class `CommonConnectionManager` provides connection lookups per file:
- `getConnectionLookup(fileURL)` — returns a `LookupConnection` that merges config sources
- `setConnectionsConfig()` — updates settings-based connections with lazy secret resolution
- `resolveConfigForFile()` — finds and parses the nearest `malloy-config.json`

Helper classes:
- `MergedConnectionLookup` — tries primary (config file) then falls back to secondary (settings/defaults)
- `SettingsConnectionLookup` — resolves `{secretKey: "..."}` values at lookup time via extension host RPC

### `connections/types.ts`
`ConnectionFactory` interface — platform-specific implementations:
- `reset()`, `getWorkingDirectory(url)`, `findMalloyConfig(fileURL, workspaceRoots, globalConfigDir)`
- Node implementation: `src/server/connections/node/connection_factory.ts`
- Browser implementation: `src/server/connections/browser/connection_factory.ts`

## Types (`types/`)

- `connection_manager_types.ts` — `ConnectionConfigManager`, `UnresolvedConnectionConfigEntry` interfaces
- `message_types.ts` — All panel/webview message protocols (query panel, connection editor, help, composer, download)
- `file_handler.ts` — `FileHandler` (extends `URLReader`), `CellData`, `Cell`, notebook cell types
- `query_spec.ts` — `DocumentMetadata` type
- `worker_message_types.ts` — Worker RPC message types

## Utilities

Small helpers — file names are self-descriptive. Notable: `completion_docs.ts` contains static markdown docs used by the language server's completion resolver.

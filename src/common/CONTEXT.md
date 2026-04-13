# Common — Shared Code

Used by extension host, language server, and worker. Must be browser-safe.

## Connection Management

`CommonConnectionManager` (`connection_manager.ts`) resolves a `MalloyConfig` per file through a three-level priority (discovered → global → settings + defaults) and caches the result. `getConnectionLookup(fileURL)` returns the resolved `config.connections`.

`ConnectionFactory` interface (in `connections/types.ts`) has a single optional `postProcessConnection` hook. Platform-specific implementations live in `src/server/connections/{node,browser}/connection_factory.ts`.

For the full connection architecture — resolution pipeline, MalloyConfig lifecycle, wrapper layering, secrets flow, factory + editor + sidebar — see **[connections/CONTEXT.md](connections/CONTEXT.md)**.

## Types (`types/`)

- `connection_manager_types.ts` — `ConnectionConfigManager`, `UnresolvedConnectionConfigEntry` interfaces
- `message_types.ts` — All panel/webview message protocols (query panel, connection editor, help, composer, download)
- `file_handler.ts` — `FileHandler` (extends `URLReader`), `CellData`, `Cell`, notebook cell types
- `query_spec.ts` — `DocumentMetadata` type
- `worker_message_types.ts` — Worker RPC message types

## Utilities

Small helpers — file names are self-descriptive. Notable: `completion_docs.ts` contains static markdown docs used by the language server's completion resolver.

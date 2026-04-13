# Connections — Architecture

Durable reference for how a Malloy file ends up with a set of live connections when a query runs. The path is complex enough — and crosses `src/common/`, `src/server/connections/`, and `src/extension/` — that it deserves one end-to-end explanation.

The core `MalloyConfig` API this builds on has its design-of-record in `~/ctx/cx/malloy-config-design.md`.

## The Core API: `MalloyConfig`

`@malloydata/malloy` ≥ 0.0.373 exposes a `MalloyConfig` class that is the contract between hosts (VS Code, CLI, Publisher) and the Malloy runtime. A `MalloyConfig` bundles:

- A `connections: LookupConnection<Connection>` — lazy factory + cache
- A resolved `manifestURL` (optional)
- An immutable snapshot of overlay-resolved config

Runtimes consume `MalloyConfig` instances. `MalloyConfig` does zero IO at construction; connections are built on first lookup.

Key pieces the extension leans on:

- **`discoverConfig(startURL, ceilingURL, urlReader)`** — walks up from a file URL looking for `malloy-config.json` (and the optional `malloy-config-local.json` sibling), returning a fully-constructed `MalloyConfig` or `null`.
- **`contextOverlay({rootDirectory, configURL})`** — host context injected as the `config` overlay so DuckDB's `workingDirectory: {default: {config: 'rootDirectory'}}` default resolves correctly.
- **`config.wrapConnections(wrapper)`** — in-place decoration of the connection lookup. Used to layer settings and post-processing on top of the core lookup.
- **`config.readOverlay(name, ...path)`** — inspect the overlays that resolved this config (e.g. to recover the matched `configURL` after discovery).
- **`config.releaseConnections()`** — closes every connection the lookup has handed out.

## The Three Resolution Levels

`CommonConnectionManager.resolveConfigForFile(fileURL)` picks one of three levels for each file. **First match wins — no merging between levels.** The presence of a config file is the trust boundary: with a config file, settings connections do not leak in.

1. **Discovered (project) config.** `discoverConfig(fileURL, workspaceFolder, urlReader)`. The workspace folder is the ceiling.
2. **Global config.** `<globalConfigDirectory>/malloy-config.json`, if the setting is set and no project config was found. The `config` overlay still gets `rootDirectory: workspaceFolder` — DuckDB's anchor is always the workspace.
3. **Settings + defaults.** `new MalloyConfig({includeDefaultConnections: true}, overlays)` — the registry fabricates one entry per backend type. Settings-based connections (`connectionMap`) are layered on top via `wrapConnections`.

## Wrapper Layering

`CommonConnectionManager.applyWrappers` installs two wrappers on every `MalloyConfig` after construction:

1. **Settings wrapper (level 3 only).** For each name in the settings `connectionMap`, the wrapper resolves `{secretKey: "..."}` references via a `SecretResolver` (implemented by the extension host over RPC against VS Code SecretStorage), then constructs a one-entry sub-`MalloyConfig` to turn the resolved POJO into a live `Connection`. Settings names take priority over defaults at level 3.

   *Why a wrapper and not an overlay?* Core overlays are synchronous (`(path) => unknown`), but SecretStorage is only reachable via async RPC from the server. The wrapper is where `await` can live. If core ever grows async overlays, the wrapper collapses into a registered `secret` overlay.

2. **`postProcessConnection` wrapper (all levels).** Called once per cached connection. Node's factory is a no-op; the browser's `WebConnectionFactory` uses this to register a `remoteTableCallback` on `DuckDBWASMConnection` instances, routing file fetches through the extension host's `malloy/fetchBinaryFile` RPC. Without this hook, DuckDB WASM queries fail to find CSV/Parquet files because files registered during schema fetch live in a different database than SQL execution.

Wrappers are pure decoration — the underlying `LookupConnection` from core still does the real work.

## Caching

`CommonConnectionManager` keeps two maps:

- `configCache`: identity-key → `CachedConfig`. Identity is either `discovered:<workspace>:<configURL>` (so nested configs within one workspace get distinct entries) or `fallback:<workspace>` (levels 2 and 3 don't vary by file within a workspace).
- `directoryIndex`: file-directory URL → identity-key. Fast path for repeated lookups of files in the same directory.

Any change to workspace roots, global config directory, settings, or a watched `malloy-config.json` calls `invalidateCache()`, which calls `releaseConnections()` on every cached `MalloyConfig` before clearing both maps. This is the only shutdown signal connections get — hence the care around invalidation events.

## Connection Factory

The `ConnectionFactory` interface lives at `src/common/connections/types.ts` and has shrunk to a single optional method:

```ts
interface ConnectionFactory {
  postProcessConnection?(conn: Connection, workingDir: string): void;
}
```

Implementations register backend types via side-effect imports:

- **`src/server/connections/node/connection_factory.ts`** (`NodeConnectionFactory`) — imports `@malloydata/malloy-connections` (all 6 db-* packages) and `@malloydata/db-publisher`. No `postProcess`.
- **`src/server/connections/browser/connection_factory.ts`** (`WebConnectionFactory`) — imports `@malloydata/db-duckdb/browser`. Implements `postProcessConnection` for DuckDB WASM `remoteTableCallback` registration.

The interface is intentionally minimal: discovery, working-directory resolution, and config finding all live in core now (`discoverConfig` + the `{config: 'rootDirectory'}` property default). The factory only exists to cover things core genuinely can't see — the live `Connection` object after creation, for host-specific post-processing like the DuckDB WASM callback.

## Defaults and the Registry

Available backend types come from `getRegisteredConnectionTypes()`. Property shapes come from `getConnectionProperties(typeName)`. Both flow from the side-effect-registered db-* packages.

`CommonConnectionManager.getDefaultConnectionTypes()` builds the list shown in the sidebar's "defaults" group:

- **Browser:** only `duckdb_wasm` is registered; it's aliased as `duckdb` for display.
- **Node:** one entry per registered type plus a legacy `md` alias that maps to `duckdb` (MotherDuck).

The `malloy/getConnectionTypeInfo` LSP request bridges the extension host (which renders tree views and editor forms) to the server (which has the registry loaded).

## Config File Format

```json
{
  "connections": {
    "warehouse": {
      "is": "postgres",
      "host": "localhost",
      "port": 5432,
      "password": {"env": "PG_PASSWORD"}
    }
  },
  "includeDefaultConnections": false
}
```

- `is` identifies the backend type.
- Single-key objects like `{env: "NAME"}` are overlay references. Built-in overlays wired by VS Code: `env` (process env vars, desktop-only) and `config` (host context — `rootDirectory`, `configURL`). No `secret` overlay is registered today; settings-connection secrets flow through the settings wrapper (see below), not the overlay system.
- `includeDefaultConnections` (default `false`): when true, the registry fabricates one entry per backend type not already declared. Level 3 always sets this; levels 1 and 2 leave it to the config author.
- `malloy-config-local.json` sits alongside `malloy-config.json` for developer-specific credentials. Core's discovery merges `connections` by name (local wins); other top-level sections from the local file replace the shared file wholesale.

## Settings

- **`malloy.globalConfigDirectory`** — directory containing a global `malloy-config.json`. Used at level 2.
- **`malloy.connectionMap`** — legacy settings-based connections. Written by the connection editor; consumed at level 3. Values may be `{secretKey: "connections.<uuid>.<field>"}` references into SecretStorage.

`projectConnectionsOnly` has been eliminated — the trust boundary is now the presence of a config file.

## Extension-Host Concerns

These live in `src/extension/` and drive the user-visible surface:

- **`connection_migration.ts`** — one-shot migration of legacy `connectionMap` entries to the new format on activation.
- **`connection_config_manager.ts`** — write path for settings connections; coordinates secret storage with the `connectionMap` setting.
- **`single_connection_editor.ts`** + `webviews/connection_editor_page/` — a React webview that edits one settings connection at a time. Three modes: Edit (existing settings), Create (new), View (read-only view of a config-file connection). Form fields are rendered generically from the registry's property definitions.
- **`tree_views/connections_view.ts`** — sidebar tree showing the effective connections for the active editor file, grouped by source (Config / Settings / Defaults). Uses `CommonConnectionManager.getEffectiveConfigSource()` to avoid reimplementing discovery. Watches `malloy-config.json` files for changes.

## Related Files

- Core: `src/common/connection_manager.ts`, `src/common/connections/types.ts`, `src/common/types/connection_manager_types.ts`
- Server: `src/server/connections/{node,browser}/connection_factory.ts`
- Extension: `src/extension/connection_migration.ts`, `src/extension/connection_config_manager.ts`, `src/extension/single_connection_editor.ts`, `src/extension/tree_views/connections_view.ts`, `src/extension/webviews/connection_editor_page/`

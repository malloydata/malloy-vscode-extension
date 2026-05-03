# Connections — Architecture

Durable reference for how a Malloy file ends up with a set of live connections when a query runs. The path is complex enough — and crosses `src/common/`, `src/server/connections/`, and `src/extension/` — that it deserves one end-to-end explanation.

The core `MalloyConfig` API this builds on has its design-of-record in `~/ctx/cx/malloy-config-design.md`. User-facing reference (config file format, overlay references, embedding) lives in the malloy repo at `packages/malloy/src/doc/configuration.md`.

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
- **`config.shutdown('close' | 'idle')`** — walks the cached connections and runs the corresponding lifecycle hook on each. `'close'` (terminal) makes the connection unusable; `'idle'` (reversible) releases backend-held resources (e.g. DuckDB closes the file lock) but leaves the connection logically valid — the next op transparently reattaches and the per-connection `schemaCache` survives. Backends without an `idle()` override get a no-op default.
- **`config.releaseConnections()`** — deprecated alias for `shutdown('close')`. Kept for the existing `invalidateCache` call site; new code uses `shutdown(...)`.

## The Three Resolution Levels

`CommonConnectionManager.resolveConfigForFile(fileURL)` picks one of three levels for each file. **First match wins — no merging between levels.** The presence of a config file is the trust boundary: with a config file, settings connections do not leak in.

> **Cell URIs are normalized first.** `resolveConfigForFile` runs `notebookCellToFileURL` (in `connection_manager.ts`) on the input URL before any of the levels below. Cell URIs (`vscode-notebook-cell:`) are not real file URIs — `discoverConfig` URL-joins `malloy-config.json` onto each parent directory, and the join preserves the cell scheme, producing URLs nothing can serve. Skip this normalization and every notebook falls through to the defaults-only fallback (level 3 minus settings) — connections from `malloy-config.json` quietly disappear, and the symptom shows up as the notebook chain failing ("cell N can't see definitions from cell K"). Regression test: `test/common/connection_manager.spec.ts`.

1. **Discovered (project) config.** `discoverConfig(fileURL, workspaceFolder, urlReader)`. The workspace folder is the ceiling.
2. **Global config.** `<globalConfigDirectory>/malloy-config.json`, if the setting is set and no project config was found. The `config` overlay still gets `rootDirectory: workspaceFolder` — DuckDB's anchor is always the workspace.
3. **Settings + defaults.** Settings-based connections (`connectionMap`) are translated into the config POJO alongside `includeDefaultConnections: true`, so the registry fabricates one entry per backend type not already declared. Secret references in settings entries resolve through a scoped `secret` overlay (see below).

## Settings via the `secret` Overlay (Level 3)

Settings connections live in VS Code's `malloy.connectionMap` setting. Sensitive values are stored in SecretStorage; the settings POJO holds `{secretKey: "connections.<uuid>.<field>"}` references in their place.

At level-3 construction, `CommonConnectionManager`:

1. Translates each settings entry by rewriting `{secretKey: X}` as `{secret: X}` — the standard overlay-reference shape.
2. Merges those entries into the POJO alongside `includeDefaultConnections: true`.
3. Registers a `secret` overlay backed by a `SecretResolver` (extension-host RPC against SecretStorage).

Core then resolves the references at connection-lookup time using the same machinery as `{env: ...}`.

**The `secret` overlay is scoped to level 3 only.** It is deliberately *not* registered when constructing a `MalloyConfig` from a discovered or global `malloy-config.json`. Two reasons:

- **Portability** — a config file that references VS Code SecretStorage wouldn't work under the CLI or Publisher, and we don't want to invite non-portable shared configs.
- **Exfiltration** — if a committed config could reference `{secret: ...}` anywhere, it becomes a read-any-secret channel (e.g. `host: {secret: "gh-token"}` sends the token to whatever server ends up in logs, UI, outbound connections). Scoping the overlay to the internal settings translation keeps that vector closed.

The general rule for any future host-private overlay (session, user attributes, OS keychain) is the same: only register it on POJOs the host itself controls end-to-end. Config-file-sourced POJOs should only see overlays whose values are safe to reference from anywhere.

## Post-Process Wrapper (All Levels)

`CommonConnectionManager.applyWrappers` installs one wrapper on every `MalloyConfig` after construction: the `postProcessConnection` hook. It's called once per cached connection. Node's factory is a no-op; the browser's `WebConnectionFactory` uses this to register a `remoteTableCallback` on `DuckDBWASMConnection` instances, routing file fetches through the extension host's `malloy/fetchBinaryFile` RPC. Without this hook, DuckDB WASM queries fail to find CSV/Parquet files because files registered during schema fetch live in a different database than SQL execution.

The wrapper is pure decoration — the underlying `LookupConnection` from core still does the real work.

## Caching

`CommonConnectionManager` keeps two maps:

- `configCache`: identity-key → `CachedConfig`. Identity is either `discovered:<workspace>:<configURL>` (so nested configs within one workspace get distinct entries) or `fallback:<workspace>` (levels 2 and 3 don't vary by file within a workspace).
- `directoryIndex`: file-directory URL → identity-key. Fast path for repeated lookups of files in the same directory.

Any change to workspace roots, global config directory, settings, or a watched `malloy-config.json` calls `invalidateCache()`, which calls `releaseConnections()` (= `shutdown('close')`) on every cached `MalloyConfig` before clearing both maps. This is the only **terminal** shutdown signal connections get — hence the care around invalidation events.

## Per-Operation Idle (the host's "op done" boundary)

VS Code is a long-running host. Backends that hold expensive per-operation state (DuckDB's OS file lock being the canonical example) need a way to be told "the operation completed; if you have anything to release, now's the time." Malloy's contract for that is `runtime.shutdown('idle')`, which delegates to `config.shutdown('idle')` and ultimately to each cached connection's `idle()` method.

The host's job is to call it, every time, in a `finally` block at every Runtime construction site. The connection's job is to do whatever's appropriate at the idle boundary.

What `idle()` actually does varies by backend and by user config:

- **DuckDB with `shareable: true`** (per-connection in `malloy-config.json`, malloy ≥ 0.0.391): `idle()` runs `DETACH` against the attached database file, releasing the OS `fcntl` lock. The next op transparently reattaches via `setupOnce()`. The C++ Connection itself is never torn down — schema cache and other connection-level state survive. This is the mode that makes VS Code + `malloy-cli` work on the same DuckDB file simultaneously.
- **DuckDB with `shareable: false`** (default): `idle()` is effectively a no-op for the lock. The lock is held for the connection's lifetime, same as it always was. Faster per-op, but blocks other tools from using the file.
- **Other backends**: `idle()` is a default no-op. Backends without expensive per-op state don't need this hook.

The `shareable` choice belongs to the user, per-connection in `malloy-config.json` — host code does not (and should not) override it. See [the malloy 0.0.391 PR](https://github.com/malloydata/malloy/pull/2795) for the design.

Call sites use the `idleRuntime(runtime)` helper from `src/util/idle_runtime.ts`, which wraps `runtime.shutdown('idle')` in a try/catch + `console.warn` so a shutdown failure can't mask the operation's result. Sites:

- `src/worker/run_query.ts` — `runMSQLCell` (notebook malloy-sql cells) and the `runQuery` regular path
- `src/worker/compile_query.ts` — compile-only path
- `src/worker/node/download_query.ts` — download/export path
- `src/server/translate_cache.ts` — every call site of the private `makeRuntime` factory (3: `translateWithTruncatedCache` and both branches of `translateWithCache`)

These call sites are load-bearing for `shareable: true` users — without them the host never signals "op done" to the connection, so `DETACH` never fires and the lock stays held until terminal close. Don't remove the `try`/`finally` wrapping when refactoring.

`invalidateCache()` (above) deliberately keeps `releaseConnections()` (= terminal close) — config-file changes mean the connection identity itself is gone, not idle.

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
- Single-key objects like `{env: "NAME"}` are overlay references. Overlays visible to a `malloy-config.json`: `env` (process env vars; desktop-only) and `config` (host context — `rootDirectory`, `configURL`). **No `secret` overlay is visible to config files** — see [Settings via the `secret` Overlay](#settings-via-the-secret-overlay-level-3) for why.
- `includeDefaultConnections` (default `false`): when true, the registry fabricates one entry per backend type not already declared. Level 3 always sets this; levels 1 and 2 leave it to the config author.
- `malloy-config-local.json` sits alongside `malloy-config.json` for developer-specific credentials. Core's discovery merges `connections` by name (local wins); other top-level sections from the local file replace the shared file wholesale.

### DuckDB-specific properties

- **`shareable: true`** (malloy ≥ 0.0.391, default `false`): releases the database file's OS lock between malloy operations so other tools (e.g. `malloy-cli build` in the integrated terminal, the `duckdb` CLI) can use the same file while malloy is running. Adds ~50ms per operation. The lock is released at the host's `idle()` boundary (see [Per-Operation Idle](#per-operation-idle-the-hosts-op-done-boundary) above), so `shareable: true` is only effective in hosts that wire idle correctly — VS Code does. Silently a no-op for `:memory:` and remote schemes (MotherDuck etc.); the normalized config records `effectiveShareable: false` in those cases.
- **`readOnly: true`**: opens the database in read-only mode. Composes correctly with `shareable: true` — under shareable mode, `readOnly` applies to the attached real file via `(READ_ONLY)` on the ATTACH, while the in-memory primary stays writable for malloy's internal scratch state.

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

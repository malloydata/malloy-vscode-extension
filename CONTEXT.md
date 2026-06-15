# Malloy VS Code Extension

> This repo uses [CONTEXT.md](https://github.com/the-michael-toy/llm-context-md) files to provide LLM-friendly documentation. Look for `CONTEXT.md` in subdirectories for localized context.

VS Code language extension for the [Malloy](https://www.malloydata.dev/) data language. Provides LSP features (completions, diagnostics, hover, go-to-definition), query execution, interactive webview panels, and notebook support.

## Architecture

Three processes communicate via IPC/RPC:

- **Extension host** (`src/extension/`) — VS Code UI, commands, webviews, tree views
- **Language server** (`src/server/`) — LSP features, Malloy compilation, caching
- **Worker** (`src/worker/`) — Query execution, connection testing (offloaded from UI thread)

Shared types and connection management live in `src/common/`.

### Dual Runtime

Every process has Node.js and browser variants. Node runs in desktop VS Code; browser runs in VS Code Web. Platform-specific code lives in `node/` and `browser/` subdirectories. Shared code must be browser-safe (no `os`, `fs`, `path` modules).

### Connection System

Registry-driven — connection types come from `@malloydata/malloy` registry at runtime. No hardcoded backend knowledge.

Four config sources (highest priority first):
1. Workspace `malloy-config.json` (found by walking up from the file's directory to the workspace root)
2. Global `malloy-config.json` (via `malloy.globalConfigDirectory` setting)
3. VS Code settings (`malloy.connectionMap`)
4. Dynamic defaults from registry

`projectConnectionsOnly` setting restricts to workspace config only.

## File Types

- `.malloy` — Malloy model/query files
- `.malloysql` — Malloy-SQL hybrid files
- `.malloynb` — Malloy notebooks (JSON-based, custom serialization)

## Key Entry Points

| What | Node | Browser |
|------|------|---------|
| Extension | `src/extension/node/extension_node.ts` | `src/extension/browser/extension_browser.ts` |
| Language server | `src/server/node/server_node.ts` | `src/server/browser/server_browser.ts` |
| Worker | `src/worker/node/message_handler.ts` | (base `message_handler.ts`) |

## Development

- **Build**: `npm run build` (tsc + esbuild)
- **Debug**: F5 in VS Code (launch configs in `.vscode/launch.json`)
- **Test**: `npx jest --no-cache`
- **Lint**: `npm run lint`
- **Type-check**: `npx tsc --noEmit -p tsconfig.json`

See `DEVELOPING.md` for full setup instructions.

### Dependency Updates

`npm run malloy-update` bumps `@malloydata/*`, then runs two guards against
native-binary breakage that otherwise only surfaces in CI (see each script's
header for the full why):

- **`sync-duckdb`** — re-pins `@duckdb/node-api` to match `@malloydata/db-duckdb`. This pin isn't imported by any source file; it only drives packaging of DuckDB's native binary into the `.vsix`, so **don't remove it** as dead.
- **`check-native`** — fails if `package-lock.json` gained a native package (lockfile entry with `os`/`cpu` or `hasInstallScript`) absent from `scripts/approved-native-deps.json`. esbuild can't bundle `.node` files, so a floated-in native dep breaks the build. Pin the dep (locally or upstream in malloy), or run `npm run approve-native` to accept it.

## Copyright

Every source file carries this header (shown in TS/JS comment style;
equivalent comment styles are used for other languages):

```
/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */
```

**Do not copy the header from a neighboring file.** Most existing files were
created when the project used a longer Google MIT header; the short SPDX form
above is what every *new* file must use. Always use the exact block above,
regardless of what the rest of the directory looks like.

This same header is also recorded in the root [`LICENSE`](LICENSE) file, in its
"SOURCE FILE HEADER" section.

## Child Contexts

- [src/CONTEXT.md](src/CONTEXT.md) — Source code domains and communication

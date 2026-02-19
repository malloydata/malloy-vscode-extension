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
1. Workspace `malloy-config.json`
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

## Child Contexts

- [src/CONTEXT.md](src/CONTEXT.md) — Source code domains and communication

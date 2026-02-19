# Source Code Overview

Four domains, each in its own directory:

```
src/
├── common/      Shared types and connection management (used by all three)
├── server/      Language server process (LSP features, compilation)
├── extension/   Extension host process (VS Code UI, commands, webviews)
└── worker/      Worker process (query execution, connection testing)
```

`util/` contains a single `no_await.ts` helper for fire-and-forget promises.

## Communication Between Domains

```
Extension Host ──LSP (IPC/Worker)──▶ Language Server
Extension Host ──RPC messages──────▶ Worker
Extension Host ──postMessage───────▶ Webviews (React panels)
```

- **Extension ↔ Server**: Standard Language Server Protocol over IPC (Node) or Web Worker (browser). Custom requests prefixed `malloy/` (e.g., `malloy/getConnectionTypeInfo`).
- **Extension ↔ Worker**: RPC via `WorkerConnection` (Node uses child process, browser uses Web Worker). Handles compile, run, test, download operations.
- **Extension ↔ Webviews**: `WebviewMessageManager` handles bidirectional JSON messaging. Messages queued until webview is visible.

## Shared Code Rules

Code in `common/` is imported by all three domains. It must:
- Not use Node.js-only modules (`os`, `fs`, `path`, `child_process`)
- Not import from `vscode` namespace
- Use `MALLOY_EXTENSION_STATE.getHomeUri()` instead of `os.homedir()`

## Child Contexts

- [common/CONTEXT.md](common/CONTEXT.md) — Shared types and connection management
- [server/CONTEXT.md](server/CONTEXT.md) — Language server
- [extension/CONTEXT.md](extension/CONTEXT.md) — Extension host
- [extension/notebook/CONTEXT.md](extension/notebook/CONTEXT.md) — Malloy notebooks

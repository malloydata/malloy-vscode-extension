# Extension — VS Code Extension Host

Runs in the VS Code process. Manages UI, commands, webviews, tree views, and notebooks.

## Entry Points

- `node/extension_node.ts` — Node.js activation: starts language server (IPC), creates worker connection, migrates legacy connections, registers all commands/views
- `browser/extension_browser.ts` — Browser activation: worker-based language server, limited capabilities

## Key Architectural Concepts

### State Singleton
`state.ts` exports `MALLOY_EXTENSION_STATE` — global mutable state for active webview panels, run states, home URI, cursor position. Provides `getHomeUri()` for browser-safe home directory access (instead of `os.homedir()`).

### Command Registration
`subscriptions.ts` is the central wiring point — registers all commands, event handlers, and RPC listeners. Command implementations live in `commands/` (file names are self-descriptive: `run_query.ts`, `show_sql.ts`, etc.). Shared query execution logic is in `commands/utils/run_query_utils.ts`.

### Webview Pattern
React-based panels in `webviews/`. Every page follows the same structure:
1. `entry.tsx` — React root mount, acquires VS Code API via `vscode_wrapper.ts`
2. Main component — page logic and layout
3. Communication via `window.postMessage` ↔ `WebviewMessageManager`

`webview_html.ts` generates the HTML shell (CSP headers, nonce, script/style injection). `WebviewMessageManager` queues messages until the webview is visible.

The connection editor (`webviews/connection_editor_page/GenericConnectionForm.tsx`) builds form fields dynamically from the connection type schema returned by the registry — no per-backend UI code.

### Connection Editor Modes

`SingleConnectionPanel` (`single_connection_editor.ts`) manages a single webview with three modes:

- **Edit** — settings connections. All fields editable. Buttons: Cancel, Duplicate, Delete (left); Test, Save (right).
- **Create** — new connections (from "+" or clicking a default). Name pre-filled with the type name. Buttons: Cancel (left); Test, Save (right).
- **View** — config file connections. All fields disabled, no Save/Delete. Buttons: Close (left); Test (right).

### Worker Communication
`worker_connection.ts` is the abstract base for RPC with the worker process. Platform variants in `node/` (child process) and `browser/` (Web Worker). Handles compile, run, test, download operations.

### Connection Migration
`connection_migration.ts` converts the legacy connection format (pre-registry) to the new format. Runs once on activation if old settings are detected.

## Tree Views

- `tree_views/connections_view.ts` — Sidebar tree showing connections grouped by config source. Watches `malloy-config.json` files for changes.
- `tree_views/schema_view.ts` — Schema tree (explores, fields, relationships) for the active file.

## Child Contexts

- [notebook/CONTEXT.md](notebook/CONTEXT.md) — Malloy notebook support

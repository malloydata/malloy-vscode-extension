# Common — Shared Code

Used by extension host, language server, and worker. Must be browser-safe.

## Connection Management

### `connection_manager.ts`
Central class `CommonConnectionManager` provides connection lookups per file:
- `getConnectionLookup(fileURL)` — returns a `LookupConnection` that merges config sources
- `setConnectionsConfig()` — updates settings-based connections with lazy secret resolution
- `resolveConfigForFile()` — finds and parses the nearest `malloy-config.json`

Default connections are built dynamically from the registry — one `{is: typeName}` per registered type, plus a legacy `md` MotherDuck alias (`{is: 'duckdb', databasePath: 'md:'}`).

Helper classes:
- `MergedConnectionLookup` — tries primary (config file) then falls back to secondary (settings/defaults)
- `SettingsConnectionLookup` — resolves `{secretKey: "..."}` values at lookup time via extension host RPC

### Config File Format

Both workspace and global config use the same `malloy-config.json` format. Connection entries use an `is` field to identify the backend type:

```json
{
  "connections": {
    "my_pg": {
      "is": "postgres",
      "host": "localhost",
      "port": 5432,
      "password": { "env": "PG_PASSWORD" }
    }
  }
}
```

Any property can use `{env: "VAR_NAME"}` to reference an environment variable, resolved at connection creation time.

### Secrets

Settings connections (stored in VS Code's `malloy.connectionMap`) keep sensitive values in the VS Code keychain rather than in plaintext settings:

- **Storage key format:** `connections.<uuid>.<fieldName>`
- **Settings reference:** the property value is replaced with `{secretKey: "connections.<uuid>.<fieldName>"}`
- **Resolution:** `SettingsConnectionLookup` reads secrets from the keychain via extension host RPC before creating the connection

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

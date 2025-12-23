# DuckDB Node Neo Migration Progress

## Status: IN PROGRESS - BigInt Serialization Issue

---

## Completed Steps

### 1. ✅ Set up npm link between malloy and VS Code extension
```bash
cd /Users/jamesswirhun/code/work/malloy/packages/malloy-db-duckdb
npm link
cd /Users/jamesswirhun/code/work/malloy-vscode-extension
npm link @malloydata/db-duckdb
```

### 2. ✅ Create feature branch in VS Code extension
- Branch: `feature/duckdb-node-neo`
- Pushed to: `https://github.com/jswir/malloy-vscode-extension`

### 3. ✅ Update dependencies
- Removed `duckdb` dependency
- Added `esbuild-plugin-replace` dev dependency

### 4. ✅ Update .vscodeignore
Added exceptions to include `@duckdb/node-bindings*` packages in VSIX:
```
!node_modules/@duckdb/node-bindings
!node_modules/@duckdb/node-bindings-darwin-arm64
!node_modules/@duckdb/node-bindings-darwin-x64
!node_modules/@duckdb/node-bindings-linux-arm64
!node_modules/@duckdb/node-bindings-linux-x64
!node_modules/@duckdb/node-bindings-win32-x64
```

### 5. ✅ Rewrite fetch_duckdb.ts
Changed from CDN tarball download to npm install approach:
```typescript
npm install --no-save --os ${os} --cpu ${cpu} --force @duckdb/node-bindings-${os}-${cpu}@${DUCKDB_VERSION}
```

### 6. ✅ Rewrite build_common.ts
- Removed `makeDuckdbNoNodePreGypPlugin` function
- Removed import of `nativeNodeModulesPlugin`
- Added `esbuild-plugin-replace` for `isDuckDBAvailable` flag
- Changed externals to `@duckdb/node-bindings`

### 7. ✅ Delete obsolete files
- `scripts/utils/fetch_node.ts`
- `third_party/github.com/evanw/esbuild/native-modules-plugin.ts`
- `third_party/github.com/evanw/esbuild/no-node-modules-sourcemaps.ts`

### 8. ✅ Test dev build
- `npm run build-extension-dev` succeeds
- DuckDB bindings load correctly

### 9. ⚠️ Test in VS Code - BLOCKED BY BIGINT ISSUE

---

## Current Issue: BigInt Serialization Error

### Error Message
```
Uncaught TypeError: Do not know how to serialize a BigInt
    at query_page.js:223599
```

### Root Cause Analysis

**Layer 1: DuckDB Connection (Working Correctly)**
- `@duckdb/node-api` returns raw data including BigInt
- Our `duckdb_connection.ts` uses `yieldRowObjectJson()` for streaming
- Uses `getRowObjectsJson()` for non-streaming queries
- **Verified working** with standalone test script

**Layer 2: Malloy Library (Where BigInts are Re-introduced)**
- Malloy wraps query results in `DataArray` class
- `DataArray.toObject()` intentionally converts large numbers to BigInt
- From `/packages/malloy/src/malloy.ts:3880`:
  ```
  * Normalizers for toObject() - returns JS native types (number | bigint, Date)
  ```
- There IS a `toJSON()` method (line 4321) that returns JSON-safe values

**Layer 3: VS Code Extension (Where It Breaks)**
- Webview calls `data.toObject()` to get query results
- Then tries `JSON.stringify(data.toObject(), null, 2)` at line 223599
- BigInt cannot be JSON serialized → Error

### Why Standalone Test Works
The test script (`/Users/jamesswirhun/code/work/malloy/test-duckdb-streaming.ts`) bypasses Malloy's data layer - it uses `runSQLStream` directly which returns JSON-safe rows. The VS Code extension goes through Malloy's data layer which re-introduces BigInts.

### The Fix
The VS Code extension's query page webview needs to use JSON-safe serialization.

**Option 1**: Change `data.toObject()` to `data.toJSON()` in the extension
**Option 2**: Add a custom JSON.stringify replacer that handles BigInt
**Option 3**: Fix in the message passing layer before postMessage

Location to fix: Search for `toObject()` calls in `/Users/jamesswirhun/code/work/malloy-vscode-extension/src/`

---

## Files Modified in VS Code Extension

| File | Status | Changes |
|------|--------|---------|
| `.vscodeignore` | ✅ Done | Added @duckdb/node-bindings packages |
| `package.json` | ✅ Done | Removed duckdb, added esbuild-plugin-replace |
| `package-lock.json` | ✅ Done | Updated |
| `scripts/build_common.ts` | ✅ Done | Simplified build, use replace plugin |
| `scripts/utils/fetch_duckdb.ts` | ✅ Done | npm install approach |
| `scripts/utils/fetch_node.ts` | ✅ Deleted | No longer needed |
| `third_party/.../native-modules-plugin.ts` | ✅ Deleted | No longer needed |
| `third_party/.../no-node-modules-sourcemaps.ts` | ✅ Deleted | No longer needed |

---

## Files Modified in Malloy Repo

| File | Status | Changes |
|------|--------|---------|
| `packages/malloy-db-duckdb/src/duckdb_connection.ts` | ✅ Done | Use `stream()` + `yieldRowObjectJson()` |

---

## Test Checklist

- [x] Dev build works (`npm run build-extension-dev`)
- [x] DuckDB bindings load correctly (verified with `node -e "require('@duckdb/node-bindings')"`)
- [x] Server bundle loads
- [x] Standalone test script works (test-duckdb-streaming.ts)
- [ ] **BLOCKED** - Extension loads in VS Code (BigInt error)
- [ ] DuckDB queries execute correctly
- [ ] Complex queries with JOINs work
- [ ] MotherDuck connection works
- [ ] Production builds for each platform
- [ ] VSIX packages correctly

---

## Symlinks for Local Development

For local dev testing, these symlinks were created:
```
node_modules/@malloydata/db-duckdb -> ../../../malloy/packages/malloy-db-duckdb
node_modules/@duckdb/node-api -> ../../../malloy/node_modules/@duckdb/node-api
node_modules/@duckdb/node-bindings -> ../../../malloy/node_modules/@duckdb/node-bindings
node_modules/@duckdb/node-bindings-darwin-arm64 -> ../../../malloy/node_modules/@duckdb/node-bindings-darwin-arm64
```

---

## Next Steps

1. **Fix BigInt serialization in VS Code extension**
   - Find where `toObject()` is called in the webview/extension
   - Change to use JSON-safe method or add replacer

2. **Test queries after fix**

3. **Create PR to malloydata/malloy-vscode-extension**

4. **Commit the malloy repo changes** (duckdb_connection.ts streaming fix)

---

## Useful Commands

```bash
# Rebuild db-duckdb after changes
cd /Users/jamesswirhun/code/work/malloy
npm run build -w @malloydata/db-duckdb

# Rebuild VS Code extension
cd /Users/jamesswirhun/code/work/malloy-vscode-extension
npm run build-extension-dev

# Run standalone test
cd /Users/jamesswirhun/code/work/malloy
npx tsx test-duckdb-streaming.ts

# Check npm link status
ls -la /Users/jamesswirhun/code/work/malloy-vscode-extension/node_modules/@malloydata/db-duckdb
```

---

## Related PRs

- malloydata/malloy-vscode-extension PR #674 - Original draft PR (used as reference)
- jswir/malloy branch `feature/duckdb-node-neo` - db-duckdb migration (already done)
- jswir/malloy-vscode-extension branch `feature/duckdb-node-neo` - This work

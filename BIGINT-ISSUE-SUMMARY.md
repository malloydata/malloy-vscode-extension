# BigInt Serialization Issue in VS Code Extension

## Context

I'm testing the VS Code extension with the `@duckdb/node-api` migration (replacing the legacy `duckdb` package). During testing, I encountered a BigInt serialization error that appears to be related to PR #2597.

## Test Setup

- VS Code extension running in Extension Development Host
- Using `@malloydata/db-duckdb` linked locally (with `@duckdb/node-api`)
- Running queries against parquet files in `malloy-samples/ecommerce`

## The Error

When running certain Malloy queries in VS Code, the webview crashes with:

```
TypeError: Do not know how to serialize a BigInt
    at query_page.js:223599
```

The error occurs in the query results webview when it tries to display the JSON preview of query results.

## What's Happening

Looking at the bundled code at line 223599:

```javascript
const json = JSON.stringify(data.toObject(), null, 2);
```

The webview calls `data.toObject()` on the query results, then tries to `JSON.stringify()` for display. Since PR #2597 made `toObject()` return `bigint` for large integers, and `JSON.stringify()` doesn't support BigInt, this throws.

## Tracing the Data Flow

1. Query executes via DuckDB connection → returns JSON-safe data ✓
2. Malloy library wraps results in `DataArray`
3. `DataArray.toObject()` normalizes values, returning `bigint` for large ints (per PR #2597)
4. VS Code webview receives data via postMessage (structured clone supports BigInt) ✓
5. Webview calls `JSON.stringify(data.toObject())` → **Error**

## Theory

It looks like the VS Code extension may need updates to handle the BigInt changes from PR #2597. The Malloy library now correctly returns `bigint` for large integers, but the VS Code extension webview still assumes it can `JSON.stringify()` the results directly.

Is this on your radar, or would a PR to fix the JSON serialization in the webview be helpful?

## Questions

1. **What's the intended fix?** I see there's a `toJSON()` method in `malloy.ts` that returns JSON-safe values (BigInt as strings). Should the VS Code extension be using that instead of `toObject()` when it needs to serialize?

2. **Are there other places in the extension that need similar updates?**

## Potential Fixes (Need Guidance)

**Option A: Use `toJSON()` instead of `toObject()`**
- Converts BigInt to string representation
- Preserves precision (string "9223372036854775807" vs lossy Number)
- Requires changes in VS Code extension webview code

**Option B: Custom JSON replacer**
```javascript
JSON.stringify(data.toObject(), (key, value) =>
  typeof value === 'bigint' ? value.toString() : value
, 2);
```
- Also preserves precision as string
- More localized fix

**Option C: Something else?**
- Is there a preferred pattern for handling BigInt in the Malloy ecosystem?

## Precision Concern

Both options A and B preserve precision by converting BigInt to string. They do NOT convert to Number (which would lose precision for values > 2^53). Is string representation acceptable for the JSON preview use case, or should there be different handling?

## Files That Need Updates

### Confirmed - Will Error on BigInt

| File | Line | Code |
|------|------|------|
| `src/extension/webviews/query_page/QueryPage.tsx` | 193 | `JSON.stringify(data.toObject(), null, 2)` |

### Possibly Affected - May Have BigInt in Data

| File | Line | Code |
|------|------|------|
| `src/extension/webviews/query_page/QueryPage.tsx` | 202 | `JSON.stringify(schema[0], null, 2)` |
| `src/extension/webviews/query_page/QueryPage.tsx` | 209 | `JSON.stringify(metadataOnly, null, 2)` |
| `src/extension/webviews/explorer_page/App.tsx` | 118 | `console.info(JSON.stringify(documentMeta, null, 2))` |

### Not Affected - Connection Options/Config Only

- `src/server/connections/node/*.ts` - These just stringify connection options, not query results
- `src/extension/telemetry.ts` - Telemetry events, no BigInt

## Malloy Library References

- `packages/malloy/src/malloy.ts:~3880` - `DataArray.toObject()` returns BigInt
- `packages/malloy/src/malloy.ts:~4321` - `toJSON()` returns JSON-safe values (BigInt as strings)

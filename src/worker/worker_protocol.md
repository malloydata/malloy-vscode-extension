# Malloy VSCode Worker Protocol

The Malloy VSCode Worker Protocols is used to communicate with a separate
worker process that the Malloy Extension spawns to offload database query
activity, particularly in process databases like DuckDB, where a process
fault would otherwise crash the extension.

The protocol is built on top of node IPC, which essentially newline separated
JSON. The only mandatory element of the= messages is the `type`, all other
elements are defined per message type. Messages requiring two-way communication
use an id parameter to match the corresponding response to the correct request.

The VSCode resident part of the worker process lives in
[worker_connection.ts](../../blob/master/src/worker/node/worker_connection.ts)
for the node version and
[worker_connection.ts](../../blob/master/src/worker/browser/worker_connection.ts)
for the browser version, the main worker file is
[worker_node.ts](../../blob/master/src/worker/node/worker_node.ts)
for the node version and
[worker_browser.ts](../../blob/master/src/worker/browser/worker_browser.ts).

## Example

**Request:**

A file read request from the worker to the VSCode extension:

```json
{
  "type": "malloy/fetch",
  "id": 67,
  "uri": "file:///data/flights.malloy"
}
```

**Response:**

A response from VSCode to the worker containing the file contents:

```json
{
  "type": "malloy/fetch",
  "id": 67,
  "uri": "file:///data/flights.malloy",
  "data": "source: flights is table('flights.parquet') {...}"
}
```

## Controller Commands

- **Log Message** - Log a message to the main Malloy debug log. The worker also
  maintains its own log, so this is just to provide better visibility for
  certain log messages.
  - Parameters:
    - `type` - "malloy/log"
    - `message` - message to log
  - Response:
    - None.
- **Read File** - Read a buffer or file. Used to make sure that the query is run
  against the latest file contents, which may not be saved to disk. Returns
  the contents of the file, either from a VS Code editor buffer or from disk.
  - Parameters:
    - `type` - "malloy/fetch"
    - `uri` - A URL to return the contents for.
    - `id` - ID to include in response.
  - Response:
    - `type` - "malloy/fetch"
    - `uri` - URL from the request.
    - `id` - ID from the request.
    - `data` - File contents or
    - `error` - Error message if an error occurred.
- **Read Binary File** - Read a buffer or file. Used to load contents into
  a local db from the VS Code virtual filesystem. Returns the contents of the
  file from the filesystem .
  - Parameters:
    - `type` - "malloy/fetchBinary"
    - `uri` - A URL to return the contents for.
    - `id` - ID to include in response.
  - Response:
    - `type` - "malloy/fetchBinary"
    - `uri` - URL from the request.
    - `id` - ID from the request.
    - `data` - File contents or
    - `error` - Error message if an error occurred.
- **Read Cell Data** - Read a set of cells from a notebook document. The data
  passed to the worker consists of only the current cell, we use this command
  to retrieve the contents and URLS of all proceeding cells so we can treat
  the cell as building on the previous ones.
  - Parameters:
    - `type` - "malloy/fetchCellData"
    - `uri` - A URL to return the contents for.
    - `id` - ID to include in response.
  - Response:
    - `type` - "malloy/fetchCellData"
    - `uri` - URL from the request.
    - `id` - ID from the request.
    - `data` - An array of objects containing the `text` and `uri` values
      for every cell up to and including the current cell.
    - `error` - Error message if an error occurred.
- **Query Panel** - Messages for updating a query panel. The contents
  are relayed directly to the appropriate query panel WebView.
  - Parameters:
    - `type`: "query_panel"
    - `panelId` - Target panel ID
    - `message` - See Query Panel Messages

## Worker Commands

- **Cancel** - Cancel a query in progress. Right now we don't interrupt
  a query in process, we simple stop processing after the current step completes
  and don't return results.
  - Parameters:
    - `type` - "malloy/cancel"
    - `panelId` - Panel generating the cancel.
  - Response:
    None.
- **Config** - Sync the VSCode config to the worker
  - Parameters:
    - `type` - "malloy/config"
    - `config` - Corresponds to the contents of the `malloy` section of
      the VS Code configuration file.
  - Response:
    - None.
- **Download** - Runs a query and save the results to disk in the specified
  format. The worker will generate a series of `query_panel` messages as the
  query progresses.
  - Parameters:
    - `type` - "malloy/download"
    - `panelId` - Panel generating the download request
    - `query` - Query Worker Spec
  - Response:
    - None.
- **Exit** - Halts the worker process
  - Parameters:
    - `type` - "malloy/exit"
  - Response:
    - None.
- **Run** - Runs a query and returns the results as JSON object. The worker
  will generate a series of `query_panel` messages as the query progresses.
  - Parameters:
    - `type` - "malloy/run"
    - `panelId` - Panel generating the download request
    - `query` - Query Worker Spec
  - Response:
    - None.

## Panel Messages

These are the panel messages used by the worker, there are other message
types that are used within the extension.

### Example

A message indicating that a query is now running against the database:

```json
{
  "type": "malloy/queryPanel",
  "panelId": "file://flights.malloy",
  "message": {
    "type": "query-status",
    "status": "Running",
    "sql": "SELECT * FROM ...",
    "dialect": "commonsql"
  }
}
```

### Message Types

- **Compiling** - Sent at the start of Malloy compilation.
  - `type` - "query-status"
  - `status` - "compiling"
- **Running** - Sent after compilation before the query is sent to the
  database.
  - `type` - "query-status"
  - `status` - "running"
  - `sql` - string;
  - `dialect` - SQL Dialect name
- **Error** - Sent when a query or compilation ends with an error.
  - `type` - "query-status"
  - `status` - "error"
  - `error` - Error message string.
- **Done** - Sent after a successful query with the results and styles.
  to apply to the visualization.
  - `type` - "query-status";
  - `status` - "done";
  - `resultJson` - JSON result object
  - `dataStyles` - Renderer styles object
  - `canDownloadStream` - Worker can stream results to a file for unlimited
    download

## Query Worker Spec

### Example

```json
{
  "type": "malloy/run",
  "panelId": "file:///data/flights.malloy",
  "query": {
    "type": "malloy/named",
    "name": "flights_dashboard",
    "uri": "file:///data/flights.malloy"
  }
}
```

### Query Types

- **Named Query**
  - `type` - "named"
  - `name` - Name of query
  - `uri` - URL of Malloy file containing the query
- **Query String**
  - `type` - "string"
  - `text` - Malloy query string
  - `uri` - URL of Malloy file containing model to run query against
- **Query File**
  - `type` - "file"
  - `index` - Index of query in the Malloy file
  - `uri` - URL of Malloy file containing the query
- **Named SQL Query**
  - `type` - "named_sql";
  - `name` - Name of query in the Malloy file
  - `uri` - URL of Malloy file containing the query
- **Unnamed SQL Query**
  - `type` - "unnamed_sql"
  - `index` - Index of query in the Malloy file
  - `uri` - URL of Malloy file containing the query

```

```

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
[worker_controller.ts](../../blob/master/src/worker/worker_controller.ts),
the main worker file is
[worker.ts](../../blob/master/src/worker/worker.ts)

## Example

**Request:**

A file read request from the worker to the VSCode extension:

```json
{
  "type": "read",
  "id": 67,
  "file": "file:///data/flights.malloy"
}
```

**Response:**

A response from VSCode to the worker containing the file contents:

```json
{
  "type": "read",
  "id": 67,
  "file": "file:///data/flights.malloy",
  "data": "source: flights is table('flights.parquet') {...}"
}
```

## Controller Commands

- **Log Message** - Log a message to the main Malloy debug log. The worker also
  maintains its own log, so this is just to provide better visibility for
  certain log messages.
  - Parameters:
    - `type` - "log"
    - `message` - message to log
  - Response:
    - None.
- **Read File** - Read a buffer or file. Used to make sure that the query is run
  against the latest file contents, which may not be saved to disk. Returns
  the contents of the file, either from a VS Code editor buffer or from disk.
  - Parameters:
    - `type` - "read"
    - `file` - A file URL to return the contents for.
    - `id` - ID to include in response.
  - Response:
    - `type` - "read"
    - `file` - File URL from the request.
    - `id` - ID from the request.
    - `data` - File contents or
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
    - `type` - "cancel"
    - `panelId` - Panel generating the cancel.
  - Response:
    None.
- **Config** - Sync the VSCode config to the worker
  - Parameters:
    - `type` - "config"
    - `config` - Corresponds to the contents of the `malloy` section of
      the VS Code configuration file.
  - Response:
    - None.
- **Download** - Runs a query and save the results to disk in the specified
  format. The worker will generate a series of `query_panel` messages as the
  query progresses.
  - Parameters:
    - `type` - "download"
    - `panelId` - Panel generating the download request
    - `query` - Query Worker Spec
  - Response:
    - None.
- **Exit** - Halts the worker process
  - Parameters:
    - `type` - "exit"
  - Response:
    - None.
- **Run** - Runs a query and returns the results as JSON object. The worker
  will generate a series of `query_panel` messages as the query progresses.
  - Parameters:
    - `type` - "run"
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
  "type": "query_panel",
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
  - `result` - JSON result object
  - `styles` - Renderer styles object

## Query Worker Spec

### Example

```json
{
  "type": "run",
  "panelId": "file:///data/flights.malloy",
  "query": {
    "type": "named",
    "name": "flights_dashboard",
    "file": "file:///data/flights.malloy"
  }
}
```

### Query Types

- **Named Query**
  - `type` - "named"
  - `name` - Name of query
  - `file` - URL of Malloy file containing the query
- **Query String**
  - `type` - "string"
  - `text` - Malloy query string
  - `file` - URL of Malloy file containing model to run query against
- **Query File**
  - `type` - "file"
  - `index` - Index of query in the Malloy file
  - `file` - URL of Malloy file containing the query
- **Named SQL Query**
  - `type` - "named_sql";
  - `name` - Name of query in the Malloy file
  - `file` - URL of Malloy file containing the query
- **Unnamed SQL Query**
  - `type` - "unnamed_sql"
  - `index` - Index of query in the Malloy file
  - `file` - URL of Malloy file containing the query

```

```

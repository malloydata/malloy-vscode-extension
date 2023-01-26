import { TestableConnection } from "@malloydata/malloy";
import { ConnectionFactory } from "../../common/connections/types";
import {
  ConfigOptions,
  ConnectionBackend,
  ConnectionConfig,
} from "../../common/connection_manager_types";
import { createBigQueryConnection } from "../../common/connections/bigquery_connection";
import { createDuckDbConnection } from "../../common/connections/duckdb_connection";
import { createPostgresConnection } from "../../common/connections/postgres_connection";
import { isDuckDBAvailable } from "../../common/duckdb_availability";

import * as path from "path";
import { fileURLToPath } from "url";

export class DesktopConnectionFactory implements ConnectionFactory {
  connectionCache: Record<string, TestableConnection> = {};

  getAvailableBackends(): ConnectionBackend[] {
    const available = [ConnectionBackend.BigQuery, ConnectionBackend.Postgres];
    if (isDuckDBAvailable) {
      available.push(ConnectionBackend.DuckDB);
    }
    return available;
  }

  async getConnectionForConfig(
    connectionConfig: ConnectionConfig,
    configOptions: ConfigOptions = {
      workingDirectory: "/",
    }
  ): Promise<TestableConnection> {
    const { useCache } = configOptions;

    let connection: TestableConnection;
    if (useCache && this.connectionCache[connectionConfig.name]) {
      return this.connectionCache[connectionConfig.name];
    }
    switch (connectionConfig.backend) {
      case ConnectionBackend.BigQuery:
        connection = await createBigQueryConnection(
          connectionConfig,
          configOptions
        );
        break;
      case ConnectionBackend.Postgres: {
        connection = await createPostgresConnection(
          connectionConfig,
          configOptions
        );
        break;
      }
      case ConnectionBackend.DuckDB: {
        connection = await createDuckDbConnection(
          connectionConfig,
          configOptions
        );
        break;
      }
    }
    if (useCache) {
      this.connectionCache[connectionConfig.name] = connection;
    }

    return connection;
  }

  getWorkingDirectory(url: URL): string {
    let workingDirectory = "/";
    if (url.protocol === "file:") {
      workingDirectory = path.dirname(fileURLToPath(url));
    }
    return workingDirectory;
  }

  addDefaults(configs: ConnectionConfig[]): ConnectionConfig[] {
    // Create a default bigquery connection if one isn't configured
    if (
      !configs.find((config) => config.backend === ConnectionBackend.BigQuery)
    ) {
      configs.push({
        name: "bigquery",
        backend: ConnectionBackend.BigQuery,
        id: "bigquery-default",
        isDefault: !configs.find((config) => config.isDefault),
      });
    }

    // Create a default duckdb connection if one isn't configured
    if (!configs.find((config) => config.name === "duckdb")) {
      configs.push({
        name: "duckdb",
        backend: ConnectionBackend.DuckDB,
        id: "duckdb-default",
        isDefault: false,
      });
    }
    return configs;
  }
}

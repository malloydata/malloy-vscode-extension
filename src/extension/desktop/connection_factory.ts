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

export class DesktopConnectionFactory implements ConnectionFactory {
  connectionCache: Record<string, TestableConnection> = {};

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
}

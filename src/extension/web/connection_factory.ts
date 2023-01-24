import { TestableConnection } from "@malloydata/malloy";
import { ConnectionFactory } from "../../common/connections/types";
import {
  ConfigOptions,
  ConnectionBackend,
  ConnectionConfig,
} from "../../common/connection_manager_types";
import { createDuckDbWasmConnection } from "../../common/connections/duckdb_wasm_connection";

export class WebConnectionFactory implements ConnectionFactory {
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
      case ConnectionBackend.DuckDBWASM: {
        connection = await createDuckDbWasmConnection(
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

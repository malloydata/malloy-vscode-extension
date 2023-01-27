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

  getAvailableBackends(): ConnectionBackend[] {
    return [ConnectionBackend.DuckDBWASM];
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

  getWorkingDirectory(url: URL): string {
    const baseUrl = new URL(".", url);
    return baseUrl.toString();
  }

  addDefaults(configs: ConnectionConfig[]): ConnectionConfig[] {
    // Create a default duckdb connection if one isn't configured
    if (!configs.find((config) => config.name === "duckdb")) {
      configs.push({
        name: "duckdb",
        backend: ConnectionBackend.DuckDBWASM,
        id: "duckdb-default",
        isDefault: false,
      });
    }
    return configs;
  }
}

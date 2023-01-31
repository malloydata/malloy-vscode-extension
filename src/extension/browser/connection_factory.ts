/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

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

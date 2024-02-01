import {
  Connection,
  ConnectionFactory,
  TestableConnection,
  registerDialect,
} from '@malloydata/malloy';
import {PluginManager} from 'live-plugin-manager';
import {
  ExternalConnectionConfig,
  ExternalConnectionPackageInfo,
  ExternalConnectionSource,
} from '../types/connection_manager_types';

// TODO(figutierrez): Can we check if package deps are in sync with these?

export class ExternalConnectionFactory {
  readonly pm = new PluginManager();
  readonly sessionInstalledPackages: Array<string> = [];

  async createOtherConnection(
    config: ExternalConnectionConfig
  ): Promise<Connection & TestableConnection> {
    if (!config.packageInfo) {
      throw new Error(
        'Can not instantiate external connection, package info not provided.'
      );
    }
    await this.installExternalConnectionPackage(config);
    const externalConnection = this.pm.require(config.packageInfo.packageName);
    // TODO: Cast factory to factory type when available.
    if (!externalConnection.connectionFactory) {
      throw new Error(
        `External package ${config.packageInfo.packageName} does not export factory connectionFactory`
      );
    }

    const factory = externalConnection.connectionFactory as ConnectionFactory;
    const connection = factory.createConnection(
      {name: config.name, ...config.configParameters},
      registerDialect
    ) as Connection & TestableConnection;
    return connection;
  }

  async fetchConnectionFactory(
    packageInfo: ExternalConnectionPackageInfo
  ): Promise<ConnectionFactory> {
    try {
      const externalConnectionPackage = this.pm.require(
        packageInfo.packageName
      );
      if (externalConnectionPackage.connectionFactory) {
        return externalConnectionPackage.connectionFactory as ConnectionFactory;
      }
    } catch (error) {
      throw new Error(
        `Could not load connection factory for external connection package ${
          packageInfo.packageName
        }. Error: ${error} ${(error as Error).stack}`
      );
    }

    throw new Error(
      `Seems like ${packageInfo.packageName} is not a valid connection since it does not export a connectionFactory.`
    );
  }

  async installExternalConnectionPackage(
    connectionConfig: ExternalConnectionConfig
  ): Promise<ExternalConnectionPackageInfo> {
    // TODO(figutierrez): Explore if force is needed.
    // TODO(figutierrez): Add Support for github.

    if (connectionConfig.packageInfo) {
      if (
        this.sessionInstalledPackages.indexOf(
          connectionConfig.packageInfo.packageName
        ) >= 0
      ) {
        return connectionConfig.packageInfo;
      }
    }

    if (!connectionConfig.path) {
      throw new Error(
        'Could not install external package, path was not provided.'
      );
    }

    switch (connectionConfig.source) {
      case ExternalConnectionSource.NPM: {
        try {
          const pi = await this.pm.installFromNpm(connectionConfig.path);
          this.sessionInstalledPackages.push(pi.name);
          return {packageName: pi.name, version: pi.version};
        } catch (error) {
          throw new Error(`Could not install package from NPM. ${error}`);
        }
      }
      case ExternalConnectionSource.LocalNPM: {
        try {
          const pi = await this.pm.installFromPath(connectionConfig.path, {
            force: true,
          });
          this.sessionInstalledPackages.push(pi.name);
          return {packageName: pi.name, version: pi.version};
        } catch (error) {
          throw new Error(
            `Could not install package from local path. ${error}`
          );
        }
      }
    }

    throw new Error(
      `Could not install package, source ${connectionConfig.source} is not supported.`
    );
  }
}

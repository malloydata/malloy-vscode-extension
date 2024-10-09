import {MySQLConnection, MySQLExecutor} from '@malloydata/db-mysql';

export const createMySQLConnection = async (): Promise<MySQLConnection> => {
  try {
    // TODO: fill properly.
    return new MySQLConnection(
      'mysql',
      MySQLExecutor.getConnectionOptionsFromEnv(),
      {}
    );
  } catch (error) {
    throw Error(`Failed to instantiate MySQL connection: ${error}`);
  }
};

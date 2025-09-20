import {MySQLConnection} from '@malloydata/db-mysql';
import {GenericConnection} from '../../../common/types/worker_message_types';
import {
  ConfigOptions,
  MysqlConnectionConfig,
} from '../../../common/types/connection_manager_types';

export const createMySQLConnection = async (
  client: GenericConnection,
  connectionConfig: MysqlConnectionConfig,
  {rowLimit, useKeyStore}: ConfigOptions
): Promise<MySQLConnection> => {
  useKeyStore ??= true;

  const options = {
    user: connectionConfig.user,
    host: connectionConfig.host,
    port: connectionConfig.port,
    database: connectionConfig.database,
    password:
      useKeyStore === true
        ? ((await client.sendRequest('malloy/getSecret', {
            key: `connections.${connectionConfig.id}.password`,
          })) as string)
        : connectionConfig.password,
  };

  console.info('Creating MySQL connection with', JSON.stringify(options));

  const connection = new MySQLConnection(connectionConfig.name, options, {
    rowLimit: rowLimit,
  });

  return connection;
};

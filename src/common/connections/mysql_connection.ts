import {MySqlConnection} from '@malloydata/malloy-mysql-connection';

export const createMySqlConnection = () => {
  return new MySqlConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'Malloydev123',
    database: 'appointments',
  });
};

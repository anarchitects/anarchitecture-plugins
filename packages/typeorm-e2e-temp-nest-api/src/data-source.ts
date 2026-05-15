import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.TYPEORM_HOST ?? 'localhost',
  port: Number.parseInt(process.env.TYPEORM_PORT ?? '5432', 10) || 5432,
  username: process.env.TYPEORM_USERNAME ?? 'postgres',
  password: process.env.TYPEORM_PASSWORD ?? 'postgres',
  database: process.env.TYPEORM_DATABASE ?? 'typeorm_e2e_temp_nest_api',
  schema: process.env.TYPEORM_SCHEMA ?? 'public',
  ssl: process.env.TYPEORM_SSL === 'true',
  applicationName:
    process.env.TYPEORM_APPLICATION_NAME ?? 'typeorm_e2e_temp_nest_api-service',
  connectTimeoutMS:
    Number.parseInt(process.env.TYPEORM_CONNECT_TIMEOUT_MS ?? '5000', 10) ||
    5000,
  synchronize: false,
  logging: false,
});

export function makeRuntimeDataSource(): DataSource {
  return new DataSource(AppDataSource.options);
}

import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database:
    process.env.TYPEORM_DATABASE ?? './tmp/typeorm_e2e_temp_plain_api.sqlite',
  busyTimeout:
    Number.parseInt(process.env.TYPEORM_BUSY_TIMEOUT ?? '5000', 10) || 5000,
  enableWAL:
    process.env.TYPEORM_ENABLE_WAL === undefined
      ? true
      : process.env.TYPEORM_ENABLE_WAL === 'true',
  synchronize: false,
  logging: false,
});

export function makeRuntimeDataSource(): DataSource {
  return new DataSource(AppDataSource.options);
}

import { AppDataSource } from './typeorm.datasource';

void AppDataSource.initialize().catch((error) => {
  console.error('Failed to initialize TypeORM data source', error);
  process.exit(1);
});

export function main() {
  return 'ok';
}

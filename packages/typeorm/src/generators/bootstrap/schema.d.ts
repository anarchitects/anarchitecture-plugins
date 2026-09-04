export interface BootstrapGeneratorSchema {
  project: string;
  domain?: string;
  schema?: string;
  db?:
    | 'postgres'
    | 'postgresql'
    | 'mysql'
    | 'mariadb'
    | 'better-sqlite3'
    | 'mssql';
  withCompose?: boolean;
  migrationDatasource?: boolean;
  skipInstall?: boolean;
  schemaPath?: string;
  migrationsDir?: string;
}

export interface BootstrapGeneratorSchema {
  project: string;
  domain?: string;
  schema?: string;
  db?:
    | 'postgres'
    | 'postgresql'
    | 'mysql'
    | 'mariadb'
    | 'sqlite'
    | 'better-sqlite3'
    | 'mssql';
  withCompose?: boolean;
  skipInstall?: boolean;
  schemaPath?: string;
  migrationsDir?: string;
}

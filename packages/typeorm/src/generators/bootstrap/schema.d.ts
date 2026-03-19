export interface BootstrapGeneratorSchema {
  project: string;
  domain?: string;
  schema?: string;
  db?: string;
  withCompose?: boolean;
  skipInstall?: boolean;
  schemaPath?: string;
  migrationsDir?: string;
}

export interface MigrationApiGeneratorSchema {
  project: string;
  name?: string;
  fileMode?: 'new' | 'patch-init';
  entityGlob?: string;
  allowMixedMigrations?: boolean;
  timestamp?: number;
}

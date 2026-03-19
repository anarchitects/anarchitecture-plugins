export interface MigrationCreateGeneratorSchema {
  project: string;
  name: string;
  directory?: string;
  outputJs?: boolean;
  esm?: boolean;
  timestamp?: number;
  args?: string[];
}

import type { ProjectRootDataSourceOptions } from '../types.js';

export interface EnsureSchemaExecutorOptions
  extends ProjectRootDataSourceOptions {
  schema?: string;
  tsconfig?: string;
}

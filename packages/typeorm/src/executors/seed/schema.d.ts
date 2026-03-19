import type { ProjectRootOnlyOptions } from '../types.js';

export interface SeedExecutorOptions extends ProjectRootOnlyOptions {
  file: string;
  export?: string;
  tsconfig?: string;
  args?: unknown[];
}

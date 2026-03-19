import type { ProjectRootOnlyOptions } from '../types.js';

export interface EntityCreateExecutorOptions extends ProjectRootOnlyOptions {
  path: string;
  args?: string[];
}

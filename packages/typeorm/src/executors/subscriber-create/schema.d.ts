import type { ProjectRootOnlyOptions } from '../types.js';

export interface SubscriberCreateExecutorOptions
  extends ProjectRootOnlyOptions {
  path: string;
  args?: string[];
}

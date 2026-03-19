import type { CliBaseOptions } from '../types.js';

export interface RunExecutorOptions extends CliBaseOptions {
  transaction?: 'all' | 'none' | 'each';
  fake?: boolean;
}

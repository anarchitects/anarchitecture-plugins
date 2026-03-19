import type { CliBaseOptions } from '../types.js';

export interface GenerateExecutorOptions extends CliBaseOptions {
  name: string;
  outputPath?: string;
  pretty?: boolean;
  driftCheck?: boolean;
  check?: boolean;
}

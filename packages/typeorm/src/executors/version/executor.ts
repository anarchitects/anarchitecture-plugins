import type { ExecutorContext } from '@nx/devkit';
import { runTypeormCommand } from '../../utils/cli.js';
import type { VersionExecutorOptions } from './schema.js';

export default async function typeormVersion(
  options: VersionExecutorOptions,
  context: ExecutorContext
) {
  const exitCode = await runTypeormCommand('version', options, context);
  return { success: exitCode === 0 };
}

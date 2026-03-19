import type { ExecutorContext } from '@nx/devkit';
import { runDataSourceTypeormCommand } from '../../utils/cli.js';
import type { CacheClearExecutorOptions } from './schema.js';

export default async function clearCache(
  options: CacheClearExecutorOptions,
  context: ExecutorContext
) {
  const exitCode = await runDataSourceTypeormCommand(
    'cache:clear',
    options,
    context
  );

  return { success: exitCode === 0 };
}

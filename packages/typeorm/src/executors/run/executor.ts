import type { ExecutorContext } from '@nx/devkit';
import { runDataSourceTypeormCommand } from '../../utils/cli.js';
import type { RunExecutorOptions } from './schema.js';

export default async function runMigrations(
  options: RunExecutorOptions,
  context: ExecutorContext
) {
  const afterDataSourceArgs: string[] = [];
  if (options.transaction) {
    afterDataSourceArgs.push('--transaction', options.transaction);
  }
  if (options.fake) {
    afterDataSourceArgs.push('--fake');
  }
  const exitCode = await runDataSourceTypeormCommand(
    'migration:run',
    options,
    context,
    {
      afterDataSourceArgs,
    }
  );

  return { success: exitCode === 0 };
}

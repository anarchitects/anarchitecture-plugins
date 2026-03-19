import type { ExecutorContext } from '@nx/devkit';
import { runDataSourceTypeormCommand } from '../../utils/cli.js';
import type { MigrationShowExecutorOptions } from './schema.js';

export default async function showMigrations(
  options: MigrationShowExecutorOptions,
  context: ExecutorContext
) {
  const exitCode = await runDataSourceTypeormCommand(
    'migration:show',
    options,
    context
  );

  return { success: exitCode === 0 };
}

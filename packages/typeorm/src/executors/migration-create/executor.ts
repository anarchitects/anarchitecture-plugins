import type { ExecutorContext } from '@nx/devkit';
import { runTypeormCommand } from '../../utils/cli.js';
import type { MigrationCreateExecutorOptions } from './schema.js';

export default async function createMigration(
  options: MigrationCreateExecutorOptions,
  context: ExecutorContext
) {
  const path = options.path?.trim();
  if (!path) {
    throw new Error('Provide a migration path via the path option.');
  }

  const commandArgs = [path];
  if (options.outputJs) {
    commandArgs.push('--outputJs');
  }
  if (options.esm) {
    commandArgs.push('--esm');
  }
  if (typeof options.timestamp === 'number') {
    commandArgs.push('--timestamp', `${options.timestamp}`);
  }

  const exitCode = await runTypeormCommand(
    'migration:create',
    options,
    context,
    commandArgs
  );

  return { success: exitCode === 0 };
}

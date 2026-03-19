import type { ExecutorContext } from '@nx/devkit';
import { runDataSourceTypeormCommand } from '../../utils/cli.js';
import type { RevertExecutorOptions } from './schema.js';

export default async function revertMigrations(
  options: RevertExecutorOptions,
  context: ExecutorContext
) {
  const count = options.count && options.count > 0 ? options.count : 1;

  for (let index = 0; index < count; index += 1) {
    const exitCode = await runDataSourceTypeormCommand(
      'migration:revert',
      options,
      context
    );
    if (exitCode !== 0) {
      return { success: false };
    }
  }

  return { success: true };
}

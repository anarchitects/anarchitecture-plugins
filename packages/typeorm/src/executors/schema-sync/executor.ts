import type { ExecutorContext } from '@nx/devkit';
import { runDataSourceTypeormCommand } from '../../utils/cli.js';
import type { SchemaSyncExecutorOptions } from './schema.js';

export default async function syncSchema(
  options: SchemaSyncExecutorOptions,
  context: ExecutorContext
) {
  const exitCode = await runDataSourceTypeormCommand(
    'schema:sync',
    options,
    context
  );

  return { success: exitCode === 0 };
}

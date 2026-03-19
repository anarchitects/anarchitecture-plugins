import type { ExecutorContext } from '@nx/devkit';
import { runDataSourceTypeormCommand } from '../../utils/cli.js';
import type { SchemaDropExecutorOptions } from './schema.js';

export default async function dropSchema(
  options: SchemaDropExecutorOptions,
  context: ExecutorContext
) {
  const exitCode = await runDataSourceTypeormCommand(
    'schema:drop',
    options,
    context
  );

  return { success: exitCode === 0 };
}

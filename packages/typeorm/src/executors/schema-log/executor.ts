import type { ExecutorContext } from '@nx/devkit';
import { runDataSourceTypeormCommand } from '../../utils/cli.js';
import type { SchemaLogExecutorOptions } from './schema.js';

export default async function logSchema(
  options: SchemaLogExecutorOptions,
  context: ExecutorContext
) {
  const exitCode = await runDataSourceTypeormCommand(
    'schema:log',
    options,
    context
  );

  return { success: exitCode === 0 };
}

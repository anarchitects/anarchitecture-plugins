import type { ExecutorContext } from '@nx/devkit';
import { runDataSourceTypeormCommand } from '../../utils/cli.js';
import type { QueryExecutorOptions } from './schema.js';

export default async function runQuery(
  options: QueryExecutorOptions,
  context: ExecutorContext
) {
  const query = options.query?.trim();
  if (!query) {
    throw new Error('Provide a SQL query via the query option.');
  }

  const exitCode = await runDataSourceTypeormCommand(
    'query',
    options,
    context,
    [query]
  );

  return { success: exitCode === 0 };
}

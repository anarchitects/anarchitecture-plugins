import type { ExecutorContext } from '@nx/devkit';
import { runTypeormCommand } from '../../utils/cli.js';
import type { InitExecutorOptions } from './schema.js';

export default async function initTypeormProject(
  options: InitExecutorOptions,
  context: ExecutorContext
) {
  const commandArgs: string[] = [];

  if (options.name && options.name.trim().length > 0) {
    commandArgs.push('--name', options.name.trim());
  }
  if (options.database && options.database.trim().length > 0) {
    commandArgs.push('--database', options.database.trim());
  }
  if (options.express) {
    commandArgs.push('--express');
  }
  if (options.docker) {
    commandArgs.push('--docker');
  }
  if (options.manager) {
    commandArgs.push('--manager', options.manager);
  }
  if (options.module) {
    commandArgs.push('--module', options.module);
  }

  const exitCode = await runTypeormCommand(
    'init',
    options,
    context,
    commandArgs
  );

  return { success: exitCode === 0 };
}

import type { ExecutorContext } from '@nx/devkit';
import { getPackageManagerCommand } from '@nx/devkit';
import {
  ensureArgs,
  ensureProjectRoot,
  relativeToWorkspace,
  splitCommand,
  type BaseExecutorOptions,
} from '../shared.js';
import { spawn } from '../../utils/spawn.js';

export interface RevertExecutorOptions extends BaseExecutorOptions {
  count?: number;
  args?: string[];
}

export default async function revertMigrations(
  options: RevertExecutorOptions,
  context: ExecutorContext
) {
  const paths = ensureProjectRoot(options, context);

  const pmc = getPackageManagerCommand();
  const execCommand = pmc.exec ?? pmc.dlx ?? 'npx';
  const [command, baseArgs] = splitCommand(execCommand);
  const args = [
    ...baseArgs,
    'typeorm-ts-node-commonjs',
    'migration:revert',
    '-d',
    relativeToWorkspace(context.root, paths.dataSource),
  ];

  if (options.count && options.count > 0) {
    args.push('--revert', String(options.count));
  }

  args.push(...ensureArgs(options.args));

  const exitCode = await spawn(command, args, { cwd: context.root });

  return { success: exitCode === 0 };
}

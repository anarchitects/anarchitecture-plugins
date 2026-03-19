import type { ExecutorContext } from '@nx/devkit';
import { getPackageManagerCommand } from '@nx/devkit';
import {
  ensureArgs,
  ensureProjectRoot,
  relativeToWorkspace,
  resolveTypeormCliRunner,
  splitCommand,
  type BaseExecutorOptions,
} from '../shared.js';
import { spawn } from '../../utils/spawn.js';

export interface RunExecutorOptions extends BaseExecutorOptions {
  transaction?: 'all' | 'none' | 'each';
  fake?: boolean;
  args?: string[];
}

export default async function runMigrations(
  options: RunExecutorOptions,
  context: ExecutorContext
) {
  const paths = ensureProjectRoot(options, context);
  const runner = resolveTypeormCliRunner(
    options,
    context,
    paths.absoluteProjectRoot
  );

  const pmc = getPackageManagerCommand();
  const execCommand = pmc.exec ?? pmc.dlx ?? 'npx';
  const [command, baseArgs] = splitCommand(execCommand);
  const args = [
    ...baseArgs,
    runner,
    'migration:run',
    '-d',
    relativeToWorkspace(context.root, paths.dataSource),
  ];

  if (options.transaction) {
    args.push('--transaction', options.transaction);
  }
  if (options.fake) {
    args.push('--fake');
  }

  args.push(...ensureArgs(options.args));

  const exitCode = await spawn(command, args, { cwd: context.root });

  return { success: exitCode === 0 };
}

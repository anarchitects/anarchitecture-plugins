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

export interface RevertExecutorOptions extends BaseExecutorOptions {
  count?: number;
  args?: string[];
}

export default async function revertMigrations(
  options: RevertExecutorOptions,
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
  const [command, commandArgs] = splitCommand(execCommand);
  const migrationArgs = [
    ...commandArgs,
    runner,
    'migration:revert',
    '-d',
    relativeToWorkspace(context.root, paths.dataSource),
  ];
  const args = [...migrationArgs, ...ensureArgs(options.args)];
  const count = options.count && options.count > 0 ? options.count : 1;

  for (let index = 0; index < count; index += 1) {
    const exitCode = await spawn(command, args, { cwd: context.root });
    if (exitCode !== 0) {
      return { success: false };
    }
  }

  return { success: true };
}

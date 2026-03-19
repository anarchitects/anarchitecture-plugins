import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import { getPackageManagerCommand } from '@nx/devkit';
import {
  defaultMigrationsDirectory,
  ensureArgs,
  ensureProjectRoot,
  normalizeName,
  projectTypeFor,
  relativeToWorkspace,
  resolveTypeormCliRunner,
  splitCommand,
  type BaseExecutorOptions,
} from '../shared.js';
import { spawn } from '../../utils/spawn.js';

export interface GenerateExecutorOptions extends BaseExecutorOptions {
  name: string;
  outputPath?: string;
  pretty?: boolean;
  driftCheck?: boolean;
  check?: boolean;
}

export default async function runGenerate(
  options: GenerateExecutorOptions,
  context: ExecutorContext
) {
  if (!options.name || options.name.trim().length === 0) {
    throw new Error('Provide a migration name via the name option.');
  }

  const normalizedName = normalizeName(options.name.trim());
  const paths = ensureProjectRoot(options, context);
  const runner = resolveTypeormCliRunner(
    options,
    context,
    paths.absoluteProjectRoot
  );
  const projectType = projectTypeFor(context);
  const outputDirectory =
    options.outputPath ??
    defaultMigrationsDirectory(paths.projectRoot, projectType);
  const targetPath = join(outputDirectory, normalizedName);

  mkdirSync(dirname(targetPath), { recursive: true });

  const pmc = getPackageManagerCommand();
  const execCommand = pmc.exec ?? pmc.dlx ?? 'npx';
  const [command, baseArgs] = splitCommand(execCommand);
  const args = [
    ...baseArgs,
    runner,
    'migration:generate',
    targetPath,
    '-d',
    relativeToWorkspace(context.root, paths.dataSource),
  ];

  if (options.pretty ?? true) {
    args.push('--pretty');
  }
  if (options.driftCheck || options.check) {
    args.push('--check');
  }
  args.push(...ensureArgs(options.args));

  const exitCode = await spawn(command, args, { cwd: context.root });

  return { success: exitCode === 0 };
}

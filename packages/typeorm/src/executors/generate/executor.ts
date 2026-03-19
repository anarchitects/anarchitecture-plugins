import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import {
  defaultMigrationsDirectory,
  normalizeName,
  projectTypeFor,
  resolveProjectRoot,
} from '../../utils/shared.js';
import { runDataSourceTypeormCommand } from '../../utils/cli.js';
import type { GenerateExecutorOptions } from './schema.js';

export default async function runGenerate(
  options: GenerateExecutorOptions,
  context: ExecutorContext
) {
  if (!options.name || options.name.trim().length === 0) {
    throw new Error('Provide a migration name via the name option.');
  }

  const normalizedName = normalizeName(options.name.trim());
  const { projectRoot } = resolveProjectRoot(options.projectRoot, context);
  const projectType = projectTypeFor(context);
  const outputDirectory =
    options.outputPath ?? defaultMigrationsDirectory(projectRoot, projectType);
  const targetPath = join(outputDirectory, normalizedName);

  mkdirSync(dirname(targetPath), { recursive: true });

  const afterDataSourceArgs: string[] = [];
  if (options.pretty ?? true) {
    afterDataSourceArgs.push('--pretty');
  }
  if (options.driftCheck || options.check) {
    afterDataSourceArgs.push('--check');
  }
  const exitCode = await runDataSourceTypeormCommand(
    'migration:generate',
    options,
    context,
    {
      beforeDataSourceArgs: [targetPath],
      afterDataSourceArgs,
    }
  );

  return { success: exitCode === 0 };
}

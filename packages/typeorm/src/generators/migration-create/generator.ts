import {
  readProjectConfiguration,
  type ProjectConfiguration,
  type ExecutorContext,
  type Tree,
} from '@nx/devkit';
import { isAbsolute, join, posix } from 'node:path';
import createMigration from '../../executors/migration-create/executor.js';
import {
  defaultMigrationsDirectory,
  normalizeName,
} from '../../utils/shared.js';
import type { MigrationCreateGeneratorSchema } from './schema.js';

export default async function migrationCreateGenerator(
  tree: Tree,
  options: MigrationCreateGeneratorSchema
) {
  const projectName = requireOption(options.project, 'project');
  const migrationName = normalizeName(requireOption(options.name, 'name'));
  const projectConfig = readProjectConfiguration(tree, projectName);
  const targetDirectory = resolveMigrationDirectory(
    projectConfig.root,
    projectConfig.projectType,
    options.directory
  );
  const targetPath = join(targetDirectory, migrationName);
  const context = createExecutorContext(tree, projectName);

  const result = await createMigration(
    {
      path: targetPath,
      outputJs: options.outputJs,
      esm: options.esm,
      timestamp: options.timestamp,
      args: options.args,
    },
    context
  );

  if (!result.success) {
    throw new Error('TypeORM migration:create failed.');
  }
}

function resolveMigrationDirectory(
  projectRoot: string,
  projectType: 'application' | 'library' | undefined,
  directory: string | undefined
): string {
  if (!directory) {
    return defaultMigrationsDirectory(projectRoot, projectType);
  }

  const normalizedDirectory = normalizeRelativeDirectory(directory);
  return join(projectRoot, normalizedDirectory);
}

function normalizeRelativeDirectory(directory: string): string {
  const trimmedDirectory = directory.trim();

  if (trimmedDirectory.length === 0) {
    throw new Error(
      'Provide a non-empty directory when using the directory option.'
    );
  }

  if (isAbsolute(trimmedDirectory)) {
    throw new Error(
      'The directory option must be relative to the project root.'
    );
  }

  const normalizedDirectory = posix
    .normalize(trimmedDirectory.replace(/\\/g, '/').replace(/^\.\//, ''))
    .replace(/^\.\//, '');

  if (
    normalizedDirectory.length === 0 ||
    normalizedDirectory === '.' ||
    normalizedDirectory === '..' ||
    normalizedDirectory.startsWith('../')
  ) {
    throw new Error('The directory option must stay within the project root.');
  }

  return normalizedDirectory;
}

function requireOption(value: string | undefined, optionName: string): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(`Provide a value for the ${optionName} option.`);
  }

  return trimmed;
}

function createExecutorContext(
  tree: Tree,
  projectName: string
): ExecutorContext {
  const projectConfig = readProjectConfiguration(tree, projectName);

  return {
    root: tree.root,
    projectName,
    projectsConfigurations: {
      version: 2,
      projects: {
        [projectName]: {
          root: projectConfig.root,
          projectType: projectConfig.projectType,
          targets: projectConfig.targets ?? {},
        } satisfies Partial<ProjectConfiguration>,
      },
    },
  } as ExecutorContext;
}

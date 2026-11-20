import { readProjectConfiguration, type Tree } from '@nx/devkit';
import { isAbsolute, join, posix } from 'node:path';
import { defaultMigrationsDirectory } from '../../utils/shared.js';
import {
  migrationScaffold,
  migrationScaffoldOptions,
  scaffoldName,
  writeNewScaffold,
} from '../../utils/scaffold.js';
import type { MigrationCreateGeneratorSchema } from './schema.js';

export default async function migrationCreateGenerator(
  tree: Tree,
  options: MigrationCreateGeneratorSchema
) {
  const projectName = requireOption(options.project, 'project');
  const migrationName = scaffoldName(requireOption(options.name, 'name'));
  const projectConfig = readProjectConfiguration(tree, projectName);
  const targetDirectory = resolveMigrationDirectory(
    projectConfig.root,
    projectConfig.projectType,
    options.directory
  );
  const scaffoldOptions = migrationScaffoldOptions(options);
  const { timestamp, outputJs } = scaffoldOptions;
  const className = migrationName.replace(
    /(?:^|[-_])(\w)/g,
    (_, letter: string) => letter.toUpperCase()
  );
  const targetPath = join(
    targetDirectory,
    `${timestamp}-${migrationName}.${outputJs ? 'js' : 'ts'}`
  );
  writeNewScaffold(
    tree,
    targetPath,
    migrationScaffold(`${className}${timestamp}`, scaffoldOptions)
  );
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

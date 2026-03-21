import {
  joinPathFragments,
  readProjectConfiguration,
  type ProjectConfiguration,
  type ExecutorContext,
  type Tree,
} from '@nx/devkit';
import { existsSync, renameSync } from 'node:fs';
import { isAbsolute, join, posix } from 'node:path';
import createEntity from '../../executors/entity-create/executor.js';
import { normalizeName, toPascalCase } from '../../utils/shared.js';
import type { EntityCreateGeneratorSchema } from './schema.js';

export default async function entityCreateGenerator(
  tree: Tree,
  options: EntityCreateGeneratorSchema
) {
  const projectName = requireOption(options.project, 'project');
  const kebabName = normalizeName(requireOption(options.name, 'name'));
  const classBaseName = ensureSuffix(toPascalCase(kebabName), 'Entity');
  const projectConfig = readProjectConfiguration(tree, projectName);
  const targetDirectory = resolveTargetDirectory(
    projectConfig.projectType,
    options.directory
  );
  const context = createExecutorContext(tree, projectName);

  const result = await createEntity(
    {
      projectRoot: projectConfig.root,
      path: joinPathFragments(targetDirectory, classBaseName),
      args: options.args,
    },
    context
  );

  if (!result.success) {
    throw new Error('TypeORM entity:create failed.');
  }

  const absDir = join(tree.root, projectConfig.root, targetDirectory);
  const generatedFile = join(absDir, `${classBaseName}.ts`);
  const expectedFile = join(absDir, `${kebabName}.entity.ts`);
  if (existsSync(generatedFile)) {
    renameSync(generatedFile, expectedFile);
  }
}

function ensureSuffix(value: string, suffix: string): string {
  return value.endsWith(suffix) ? value : `${value}${suffix}`;
}

function resolveTargetDirectory(
  projectType: 'application' | 'library' | undefined,
  directory: string | undefined
): string {
  if (!directory) {
    return projectType === 'application'
      ? 'src/entities'
      : 'src/infrastructure-persistence/entities';
  }

  return normalizeRelativeDirectory(directory);
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

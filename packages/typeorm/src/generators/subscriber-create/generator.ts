import {
  joinPathFragments,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { isAbsolute, posix } from 'node:path';
import { toPascalCase } from '../../utils/shared.js';
import {
  assertNoScaffoldArgs,
  scaffoldName,
  writeNewScaffold,
} from '../../utils/scaffold.js';
import type { SubscriberCreateGeneratorSchema } from './schema.js';

export default async function subscriberCreateGenerator(
  tree: Tree,
  options: SubscriberCreateGeneratorSchema
) {
  const projectName = requireOption(options.project, 'project');
  const kebabName = scaffoldName(requireOption(options.name, 'name'));
  const classBaseName = ensureSuffix(toPascalCase(kebabName), 'Subscriber');
  const projectConfig = readProjectConfiguration(tree, projectName);
  const targetDirectory = resolveTargetDirectory(
    projectConfig.projectType,
    options.directory
  );
  assertNoScaffoldArgs(options.args);
  const targetPath = joinPathFragments(
    projectConfig.root,
    targetDirectory,
    `${kebabName}.subscriber.ts`
  );
  writeNewScaffold(
    tree,
    targetPath,
    `import { EventSubscriber, EntitySubscriberInterface } from 'typeorm';

@EventSubscriber()
export class ${classBaseName} implements EntitySubscriberInterface {}
`
  );
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
      ? 'src/subscribers'
      : 'src/infrastructure-persistence/subscribers';
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

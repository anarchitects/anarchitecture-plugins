import { isAbsolute, join, relative, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { ExecutorContext } from '@nx/devkit';

export interface BaseExecutorOptions {
  projectRoot?: string;
  dataSource?: string;
  args?: string[];
}

export interface WorkspacePaths {
  projectRoot: string;
  absoluteProjectRoot: string;
  dataSource: string;
}

const CANDIDATE_DATASOURCES = [
  'tools/typeorm/datasource.migrations.ts',
  'tools/typeorm/datasource.migrations.js',
  'src/typeorm.datasource.ts',
  'src/typeorm.datasource.js',
];

export function ensureProjectRoot(
  options: BaseExecutorOptions,
  context: ExecutorContext
): WorkspacePaths {
  const { projectRoot, absoluteProjectRoot } = resolveProjectRoot(
    options.projectRoot,
    context
  );

  const dataSource = resolveDataSource(options.dataSource, absoluteProjectRoot);

  return { projectRoot, absoluteProjectRoot, dataSource };
}

export function resolveProjectRoot(
  configuredRoot: string | undefined,
  context: ExecutorContext
): { projectRoot: string; absoluteProjectRoot: string } {
  const projectConfig =
    context.projectsConfigurations?.projects?.[context.projectName ?? ''];
  const projectRoot = configuredRoot ?? projectConfig?.root;

  if (!projectRoot) {
    throw new Error('Unable to determine project root. Provide projectRoot.');
  }

  const absoluteProjectRoot = isAbsolute(projectRoot)
    ? projectRoot
    : resolve(context.root, projectRoot);

  return { projectRoot, absoluteProjectRoot };
}

function resolveDataSource(
  explicit: string | undefined,
  absoluteProjectRoot: string
): string {
  if (explicit) {
    return absoluteFrom(explicit, absoluteProjectRoot);
  }

  for (const candidate of CANDIDATE_DATASOURCES) {
    const absoluteCandidate = join(absoluteProjectRoot, candidate);
    if (existsSync(absoluteCandidate)) {
      return absoluteCandidate;
    }
  }

  throw new Error(
    'Unable to locate a TypeORM data source. Add one or pass the dataSource option.'
  );
}

function absoluteFrom(pathValue: string, absoluteProjectRoot: string): string {
  return isAbsolute(pathValue)
    ? pathValue
    : resolve(absoluteProjectRoot, pathValue);
}

export function splitCommand(command: string): [string, string[]] {
  const [cmd, ...rest] = command.split(' ');
  return [cmd, rest];
}

export function relativeToWorkspace(root: string, filePath: string): string {
  return relative(root, filePath) || '.';
}

export function defaultMigrationsDirectory(
  projectRoot: string,
  projectType: 'application' | 'library' | undefined
): string {
  if (projectType === 'application') {
    return join(projectRoot, 'tools/typeorm/migrations');
  }

  return join(projectRoot, 'src/infrastructure-persistence/migrations');
}

export function ensureArgs(options?: string[]): string[] {
  return options?.filter((arg) => arg.trim().length > 0) ?? [];
}

export function projectTypeFor(
  context: ExecutorContext
): 'application' | 'library' | undefined {
  return context.projectsConfigurations?.projects?.[context.projectName ?? '']
    ?.projectType as 'application' | 'library' | undefined;
}

export function schemaFilePath(projectRoot: string): string {
  return join(projectRoot, 'src/infrastructure-persistence/schema.ts');
}

export function schemaNameFrom(contents: string): string | undefined {
  const match = contents.match(/'=([^']+)'/);
  return match?.[1];
}

export function normalizeName(name: string): string {
  return name.replace(/\s+/g, '-');
}

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { ExecutorContext, ProjectConfiguration } from '@nx/devkit';

export type ModuleSystem = 'auto' | 'commonjs' | 'esm';
export type TypeormCliRunner =
  | 'typeorm-ts-node-commonjs'
  | 'typeorm-ts-node-esm';

export interface BaseExecutorOptions {
  projectRoot?: string;
  dataSource?: string;
  args?: string[];
  moduleSystem?: ModuleSystem;
}

export interface WorkspacePaths {
  projectRoot: string;
  absoluteProjectRoot: string;
  dataSource: string;
}

const CANDIDATE_DATASOURCES = [
  'tools/typeorm/datasource.migrations.ts',
  'tools/typeorm/datasource.migrations.js',
  'src/data-source.ts',
  'src/data-source.js',
  'src/typeorm.datasource.ts',
  'src/typeorm.datasource.js',
];
const DEFAULT_TS_CONFIG_NAMES = [
  'tsconfig.app.json',
  'tsconfig.lib.json',
  'tsconfig.build.json',
  'tsconfig.json',
];
const ESM_RUNNER: TypeormCliRunner = 'typeorm-ts-node-esm';
const CJS_RUNNER: TypeormCliRunner = 'typeorm-ts-node-commonjs';
const requireFromExecutor = createRequire(import.meta.url);

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

export function resolveTypeormCliRunner(
  options: Pick<BaseExecutorOptions, 'moduleSystem'>,
  context: ExecutorContext,
  absoluteProjectRoot: string
): TypeormCliRunner {
  const moduleSystem = detectModuleSystem(
    options,
    context,
    absoluteProjectRoot
  );
  const runner = moduleSystem === 'esm' ? ESM_RUNNER : CJS_RUNNER;

  assertRunnerInstalled(runner, context.root);

  return runner;
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

function detectModuleSystem(
  options: Pick<BaseExecutorOptions, 'moduleSystem'>,
  context: ExecutorContext,
  absoluteProjectRoot: string
): 'commonjs' | 'esm' {
  if (options.moduleSystem === 'commonjs' || options.moduleSystem === 'esm') {
    return options.moduleSystem;
  }

  const packageModuleSystem = moduleSystemFromNearestPackageJson(
    context.root,
    absoluteProjectRoot
  );
  if (packageModuleSystem) {
    return packageModuleSystem;
  }

  if (moduleSystemFromProjectTsConfig(context, absoluteProjectRoot) === 'esm') {
    return 'esm';
  }

  return 'commonjs';
}

function moduleSystemFromNearestPackageJson(
  workspaceRoot: string,
  absoluteProjectRoot: string
): 'commonjs' | 'esm' | undefined {
  const resolvedWorkspaceRoot = resolve(workspaceRoot);
  let currentDir = absoluteProjectRoot;

  while (isWithinOrEqual(currentDir, resolvedWorkspaceRoot)) {
    const packageJsonPath = join(currentDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          readFileSync(packageJsonPath, 'utf-8')
        ) as {
          type?: string;
        };

        if (packageJson.type === 'module') {
          return 'esm';
        }
      } catch {
        // best effort: ignore malformed package.json files
      }
    }

    if (currentDir === resolvedWorkspaceRoot) {
      break;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return undefined;
}

function moduleSystemFromProjectTsConfig(
  context: ExecutorContext,
  absoluteProjectRoot: string
): 'esm' | undefined {
  const candidates = tsConfigCandidates(context, absoluteProjectRoot);

  for (const tsConfigPath of candidates) {
    if (isEsmTsConfig(tsConfigPath, new Set<string>())) {
      return 'esm';
    }
  }

  return undefined;
}

function tsConfigCandidates(
  context: ExecutorContext,
  absoluteProjectRoot: string
): string[] {
  const candidates = new Set<string>();

  for (const name of DEFAULT_TS_CONFIG_NAMES) {
    candidates.add(resolve(absoluteProjectRoot, name));
  }

  const projectConfig = getProjectConfiguration(context);
  const targets = projectConfig?.targets as
    | Record<string, Record<string, unknown>>
    | undefined;

  if (targets) {
    for (const target of Object.values(targets)) {
      collectTsConfigPathsFromObject(
        target.options as Record<string, unknown> | undefined,
        context,
        absoluteProjectRoot,
        candidates
      );

      const configurations = target.configurations as
        | Record<string, Record<string, unknown>>
        | undefined;
      if (!configurations) {
        continue;
      }

      for (const configuration of Object.values(configurations)) {
        collectTsConfigPathsFromObject(
          configuration,
          context,
          absoluteProjectRoot,
          candidates
        );
      }
    }
  }

  return [...candidates].filter((pathValue) => existsSync(pathValue));
}

function collectTsConfigPathsFromObject(
  value: Record<string, unknown> | undefined,
  context: ExecutorContext,
  absoluteProjectRoot: string,
  candidates: Set<string>
) {
  if (!value) {
    return;
  }

  const tsConfigValue = value.tsConfig;
  if (typeof tsConfigValue !== 'string' || tsConfigValue.trim().length === 0) {
    return;
  }

  const normalized = tsConfigValue.trim();
  if (isAbsolute(normalized)) {
    candidates.add(normalized);
    return;
  }

  const workspaceRelative = resolve(context.root, normalized);
  if (existsSync(workspaceRelative)) {
    candidates.add(workspaceRelative);
    return;
  }

  candidates.add(resolve(absoluteProjectRoot, normalized));
}

function isEsmTsConfig(tsConfigPath: string, seen: Set<string>): boolean {
  const resolvedPath = resolve(tsConfigPath);
  if (seen.has(resolvedPath) || !existsSync(resolvedPath)) {
    return false;
  }

  seen.add(resolvedPath);
  let contents = '';
  try {
    contents = readFileSync(resolvedPath, 'utf-8');
  } catch {
    return false;
  }

  const moduleValue = extractCompilerModule(contents);
  if (moduleValue && isEsmModule(moduleValue)) {
    return true;
  }

  const extendsValue = extractExtends(contents);
  if (!extendsValue) {
    return false;
  }

  const extendedTsConfigPath = resolveExtendedTsConfigPath(
    extendsValue,
    dirname(resolvedPath)
  );
  if (!extendedTsConfigPath) {
    return false;
  }

  return isEsmTsConfig(extendedTsConfigPath, seen);
}

function extractCompilerModule(contents: string): string | undefined {
  const moduleMatch = contents.match(/"module"\s*:\s*"([^"]+)"/i);
  return moduleMatch?.[1]?.trim();
}

function extractExtends(contents: string): string | undefined {
  const extendsMatch = contents.match(/"extends"\s*:\s*"([^"]+)"/i);
  return extendsMatch?.[1]?.trim();
}

function resolveExtendedTsConfigPath(
  extendsValue: string,
  currentDirectory: string
): string | undefined {
  if (!extendsValue.startsWith('.') && !extendsValue.startsWith('/')) {
    return undefined;
  }

  const basePath = extendsValue.startsWith('/')
    ? extendsValue
    : resolve(currentDirectory, extendsValue);
  const candidates = [
    basePath,
    `${basePath}.json`,
    join(basePath, 'tsconfig.json'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function isEsmModule(moduleValue: string): boolean {
  const normalized = moduleValue.toLowerCase();
  if (
    normalized === 'esnext' ||
    normalized === 'node16' ||
    normalized === 'node18' ||
    normalized === 'node20' ||
    normalized === 'nodenext'
  ) {
    return true;
  }

  if (!normalized.startsWith('es20')) {
    return false;
  }

  const year = Number(normalized.slice(2));
  return Number.isFinite(year) && year >= 2020;
}

function assertRunnerInstalled(
  runner: TypeormCliRunner,
  workspaceRoot: string
) {
  try {
    requireFromExecutor.resolve(`${runner}/package.json`, {
      paths: [workspaceRoot],
    });
  } catch {
    throw new Error(
      `TypeORM CLI runner "${runner}" is not installed. Install "${runner}" (or run @anarchitects/nx-typeorm:bootstrap) or set moduleSystem to a compatible value.`
    );
  }
}

function isWithinOrEqual(pathValue: string, rootPath: string): boolean {
  const rel = relative(rootPath, pathValue);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function getProjectConfiguration(
  context: ExecutorContext
): ProjectConfiguration | undefined {
  return context.projectsConfigurations?.projects?.[
    context.projectName ?? ''
  ] as ProjectConfiguration | undefined;
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
  return getProjectConfiguration(context)?.projectType as
    | 'application'
    | 'library'
    | undefined;
}

export function schemaFilePath(projectRoot: string): string {
  return join(projectRoot, 'src/infrastructure-persistence/schema.ts');
}

export function schemaNameFrom(contents: string): string | undefined {
  const match = contents.match(/SCHEMA\s*=\s*['"]([^'"\s]+)['"]/);
  return match?.[1];
}

export function normalizeName(name: string): string {
  return name.replace(/\s+/g, '-');
}

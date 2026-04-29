import {
  joinPathFragments,
  normalizePath,
  readJson,
  type Tree,
} from '@nx/devkit';
import { posix as path } from 'node:path';

export interface NestProjectDetectionResult {
  isNestProject: boolean;
  projectRoot: string;
  sourceRoot?: string;
  hasNestCliJson: boolean;
  hasNestCoreDependency: boolean;
  hasMainEntrypoint: boolean;
  moduleSystem?: 'esm' | 'cjs';
  testRunner?: 'vitest' | 'jest';
  compiler?: 'tsc' | 'swc';
}

type PackageJson = {
  type?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type NestCliProjectConfig = {
  root?: string;
  sourceRoot?: string;
  entryFile?: string;
  compilerOptions?: {
    builder?: string;
  };
};

type NestCliConfig = NestCliProjectConfig & {
  monorepo?: boolean;
  projects?: Record<string, NestCliProjectConfig | undefined>;
};

type PackageSignalScope = 'project' | 'workspace';

type NestCliMatch = {
  hasNestCliJson: boolean;
  sourceRoot?: string;
  entryFile?: string;
  compiler?: 'swc' | 'tsc';
};

type SignalMatch<T> = T | 'ambiguous' | undefined;

const DEFAULT_SOURCE_ROOT = 'src';
const DEFAULT_ENTRY_FILE = 'main';
const VITEST_CONFIG_FILES = [
  'vitest.config.ts',
  'vitest.config.mts',
  'vitest.config.cts',
  'vitest.config.js',
  'vitest.config.mjs',
  'vitest.config.cjs',
];
const JEST_CONFIG_FILES = [
  'jest.config.ts',
  'jest.config.mts',
  'jest.config.cts',
  'jest.config.js',
  'jest.config.mjs',
  'jest.config.cjs',
  'jest.preset.js',
  'jest.preset.mjs',
  'jest.preset.cjs',
];
const TS_CONFIG_FILES = [
  'tsconfig.app.json',
  'tsconfig.build.json',
  'tsconfig.json',
];

export function detectNestProject(
  tree: Tree,
  projectRoot: string
): NestProjectDetectionResult {
  const normalizedProjectRoot = normalizeProjectRoot(projectRoot);
  const nearestPackageJsonPath = findNearestPackageJsonPath(
    tree,
    normalizedProjectRoot
  );
  const workspacePackageJsonPath = tree.exists('package.json')
    ? 'package.json'
    : undefined;
  const nearestPackageJson = readJsonFile<PackageJson>(
    tree,
    nearestPackageJsonPath
  );
  const workspacePackageJson =
    workspacePackageJsonPath &&
    workspacePackageJsonPath !== nearestPackageJsonPath
      ? readJsonFile<PackageJson>(tree, workspacePackageJsonPath)
      : nearestPackageJson;

  const nearestPackageScope = classifyPackageScope(
    nearestPackageJsonPath,
    normalizedProjectRoot
  );
  const nestCliMatch = resolveNestCliMatch(tree, normalizedProjectRoot);
  const sourceRoot =
    nestCliMatch.sourceRoot ??
    (tree.exists(projectPath(normalizedProjectRoot, 'src/main.ts'))
      ? projectPath(normalizedProjectRoot, DEFAULT_SOURCE_ROOT)
      : undefined);
  const mainEntrypointPath = resolveMainEntrypointPath(
    normalizedProjectRoot,
    sourceRoot,
    nestCliMatch.entryFile
  );
  const mainEntrypointContents = readTextFile(tree, mainEntrypointPath);
  const hasMainEntrypoint = Boolean(mainEntrypointContents);
  const hasNestCoreImportInMain =
    mainEntrypointContents !== undefined &&
    /['"]@nestjs\/core['"]/.test(mainEntrypointContents);

  const nearestPackageHasNestCore =
    nearestPackageJson !== undefined &&
    hasPackageDependency(nearestPackageJson, '@nestjs/core');
  const workspacePackageHasNestCore =
    workspacePackageJsonPath !== undefined &&
    workspacePackageJsonPath !== nearestPackageJsonPath &&
    workspacePackageJson !== undefined &&
    hasPackageDependency(workspacePackageJson, '@nestjs/core');
  const hasNestCoreDependency =
    nearestPackageHasNestCore || workspacePackageHasNestCore;

  const testRunner = detectTestRunner(
    tree,
    normalizedProjectRoot,
    nearestPackageJson,
    nearestPackageScope,
    workspacePackageJson,
    workspacePackageJsonPath
  );

  const hasNestSignals =
    nestCliMatch.hasNestCliJson ||
    hasNestCoreDependency ||
    hasNestCoreImportInMain ||
    hasMainEntrypoint;
  const compiler = hasNestSignals
    ? detectCompiler(
        tree,
        normalizedProjectRoot,
        nestCliMatch,
        nearestPackageJson,
        nearestPackageScope,
        workspacePackageJson,
        workspacePackageJsonPath
      )
    : undefined;

  const moduleSystem = detectModuleSystem(nearestPackageJson);
  const hasProjectScopedNestCore =
    nearestPackageHasNestCore && nearestPackageScope === 'project';
  const hasWorkspaceScopedNestCore =
    (nearestPackageHasNestCore && nearestPackageScope === 'workspace') ||
    workspacePackageHasNestCore;

  const isNestProject =
    nestCliMatch.hasNestCliJson ||
    hasProjectScopedNestCore ||
    (hasWorkspaceScopedNestCore && hasNestCoreImportInMain);

  return {
    isNestProject,
    projectRoot: projectRoot,
    sourceRoot,
    hasNestCliJson: nestCliMatch.hasNestCliJson,
    hasNestCoreDependency,
    hasMainEntrypoint,
    moduleSystem,
    testRunner,
    compiler,
  };
}

function normalizeProjectRoot(projectRoot: string): string {
  const normalized = normalizePath(projectRoot).replace(/^\.\/+/, '');
  if (normalized === '.' || normalized === '') {
    return '';
  }

  return normalized.replace(/\/+$/, '');
}

function projectPath(projectRoot: string, relativePath: string): string {
  return projectRoot
    ? joinPathFragments(projectRoot, relativePath)
    : normalizePath(relativePath);
}

function readTextFile(
  tree: Tree,
  filePath: string | undefined
): string | undefined {
  if (!filePath || !tree.exists(filePath)) {
    return undefined;
  }

  const contents = tree.read(filePath, 'utf-8');
  return contents ?? undefined;
}

function readJsonFile<T>(
  tree: Tree,
  filePath: string | undefined
): T | undefined {
  if (!filePath || !tree.exists(filePath)) {
    return undefined;
  }

  try {
    return readJson(tree, filePath) as T;
  } catch {
    // Best effort only: malformed config should not throw during detection.
  }

  return undefined;
}

function findNearestPackageJsonPath(
  tree: Tree,
  projectRoot: string
): string | undefined {
  let currentDir = projectRoot;

  while (true) {
    const packageJsonPath = projectPath(currentDir, 'package.json');
    if (tree.exists(packageJsonPath)) {
      return packageJsonPath;
    }

    if (!currentDir) {
      break;
    }

    const parentDir = path.dirname(currentDir);
    currentDir = parentDir === '.' ? '' : parentDir;
  }

  return undefined;
}

function classifyPackageScope(
  packageJsonPath: string | undefined,
  projectRoot: string
): PackageSignalScope | undefined {
  if (!packageJsonPath) {
    return undefined;
  }

  const packageRoot = path.dirname(packageJsonPath);
  if (!projectRoot && packageJsonPath === 'package.json') {
    return 'project';
  }

  return packageRoot === projectRoot ? 'project' : 'workspace';
}

function resolveNestCliMatch(tree: Tree, projectRoot: string): NestCliMatch {
  const projectNestCliPath = projectPath(projectRoot, 'nest-cli.json');
  const projectNestCli = readJsonFile<NestCliConfig>(tree, projectNestCliPath);
  if (projectNestCli) {
    const normalizedSourceRoot = normalizeSourceRoot(
      projectRoot,
      projectRoot,
      projectNestCli.sourceRoot
    );

    return {
      hasNestCliJson: true,
      sourceRoot: normalizedSourceRoot,
      entryFile: normalizeEntryFile(projectNestCli.entryFile),
      compiler:
        projectNestCli.compilerOptions?.builder === 'swc' ? 'swc' : 'tsc',
    };
  }

  const workspaceNestCli = readJsonFile<NestCliConfig>(tree, 'nest-cli.json');
  if (!workspaceNestCli) {
    return {
      hasNestCliJson: false,
    };
  }

  const matchedProject = matchWorkspaceNestCliProject(
    workspaceNestCli,
    projectRoot
  );
  if (!matchedProject) {
    return {
      hasNestCliJson: false,
    };
  }

  const sourceRoot = normalizeSourceRoot(
    projectRoot,
    matchedProject.root,
    matchedProject.sourceRoot ?? workspaceNestCli.sourceRoot
  );

  return {
    hasNestCliJson: true,
    sourceRoot,
    entryFile: normalizeEntryFile(
      matchedProject.entryFile ?? workspaceNestCli.entryFile
    ),
    compiler:
      matchedProject.compilerOptions?.builder === 'swc' ||
      workspaceNestCli.compilerOptions?.builder === 'swc'
        ? 'swc'
        : 'tsc',
  };
}

function matchWorkspaceNestCliProject(
  config: NestCliConfig,
  projectRoot: string
): NestCliProjectConfig | undefined {
  if (matchesProjectRoot(config.root, config.sourceRoot, projectRoot)) {
    return config;
  }

  for (const projectConfig of Object.values(config.projects ?? {})) {
    if (
      projectConfig &&
      matchesProjectRoot(
        projectConfig.root,
        projectConfig.sourceRoot,
        projectRoot
      )
    ) {
      return projectConfig;
    }
  }

  return undefined;
}

function matchesProjectRoot(
  configuredRoot: string | undefined,
  configuredSourceRoot: string | undefined,
  projectRoot: string
): boolean {
  const normalizedRoot = normalizeConfigPath(configuredRoot);
  if (normalizedRoot && normalizedRoot === projectRoot) {
    return true;
  }

  const normalizedSourceRoot = normalizeConfigPath(configuredSourceRoot);
  if (!normalizedSourceRoot) {
    return false;
  }

  return normalizedSourceRoot === projectPath(projectRoot, DEFAULT_SOURCE_ROOT);
}

function normalizeSourceRoot(
  projectRoot: string,
  configuredRoot: string | undefined,
  sourceRoot: string | undefined
): string | undefined {
  const normalizedSourceRoot = normalizeConfigPath(sourceRoot);
  if (!normalizedSourceRoot) {
    return undefined;
  }

  if (
    normalizedSourceRoot === projectPath(projectRoot, DEFAULT_SOURCE_ROOT) ||
    normalizedSourceRoot.startsWith(`${projectRoot}/`)
  ) {
    return normalizedSourceRoot;
  }

  const normalizedConfiguredRoot = normalizeConfigPath(configuredRoot);
  if (normalizedConfiguredRoot) {
    if (
      normalizedSourceRoot ===
        projectPath(normalizedConfiguredRoot, DEFAULT_SOURCE_ROOT) ||
      normalizedSourceRoot.startsWith(`${normalizedConfiguredRoot}/`)
    ) {
      return normalizedSourceRoot;
    }

    return projectPath(normalizedConfiguredRoot, normalizedSourceRoot);
  }

  if (!normalizedSourceRoot.includes('/')) {
    return projectPath(projectRoot, normalizedSourceRoot);
  }

  return normalizedSourceRoot;
}

function normalizeConfigPath(
  pathValue: string | undefined
): string | undefined {
  if (!pathValue || pathValue.trim().length === 0) {
    return undefined;
  }

  return normalizePath(pathValue.trim()).replace(/^\.\/+/, '');
}

function normalizeEntryFile(entryFile: string | undefined): string | undefined {
  if (!entryFile || entryFile.trim().length === 0) {
    return undefined;
  }

  const normalized = normalizePath(entryFile.trim()).replace(/^\.\/+/, '');
  return normalized.replace(/\.(cts|mts|ts|cjs|mjs|js)$/, '');
}

function resolveMainEntrypointPath(
  projectRoot: string,
  sourceRoot: string | undefined,
  entryFile: string | undefined
): string {
  const normalizedEntryFile = entryFile ?? DEFAULT_ENTRY_FILE;
  const normalizedSourceRoot =
    sourceRoot ?? projectPath(projectRoot, DEFAULT_SOURCE_ROOT);

  return normalizedEntryFile.endsWith('.ts')
    ? projectPath(
        '',
        joinPathFragments(normalizedSourceRoot, normalizedEntryFile)
      )
    : projectPath(
        '',
        joinPathFragments(normalizedSourceRoot, `${normalizedEntryFile}.ts`)
      );
}

function hasPackageDependency(
  packageJson: PackageJson,
  dependencyName: string
): boolean {
  return Boolean(
    packageJson.dependencies?.[dependencyName] ??
      packageJson.devDependencies?.[dependencyName] ??
      packageJson.peerDependencies?.[dependencyName]
  );
}

function detectModuleSystem(
  packageJson: PackageJson | undefined
): 'esm' | 'cjs' | undefined {
  if (!packageJson) {
    return undefined;
  }

  return packageJson.type === 'module' ? 'esm' : 'cjs';
}

function detectTestRunner(
  tree: Tree,
  projectRoot: string,
  nearestPackageJson: PackageJson | undefined,
  nearestPackageScope: PackageSignalScope | undefined,
  workspacePackageJson: PackageJson | undefined,
  workspacePackageJsonPath: string | undefined
): 'vitest' | 'jest' | undefined {
  const projectConfigMatch = detectTestRunnerFromConfig(tree, projectRoot);
  if (projectConfigMatch === 'vitest' || projectConfigMatch === 'jest') {
    return projectConfigMatch;
  }
  if (projectConfigMatch === 'ambiguous') {
    return undefined;
  }

  if (nearestPackageScope === 'project') {
    const projectPackageMatch =
      detectTestRunnerFromPackageJson(nearestPackageJson);
    if (projectPackageMatch === 'vitest' || projectPackageMatch === 'jest') {
      return projectPackageMatch;
    }
    if (projectPackageMatch === 'ambiguous') {
      return undefined;
    }
  }

  if (projectRoot) {
    const workspaceConfigMatch = detectTestRunnerFromConfig(tree, '');
    if (workspaceConfigMatch === 'vitest' || workspaceConfigMatch === 'jest') {
      return workspaceConfigMatch;
    }
    if (workspaceConfigMatch === 'ambiguous') {
      return undefined;
    }
  }

  if (workspacePackageJsonPath) {
    const workspacePackageMatch =
      detectTestRunnerFromPackageJson(workspacePackageJson);
    if (
      workspacePackageMatch === 'vitest' ||
      workspacePackageMatch === 'jest'
    ) {
      return workspacePackageMatch;
    }
  }

  return undefined;
}

function detectTestRunnerFromConfig(
  tree: Tree,
  root: string
): SignalMatch<'vitest' | 'jest'> {
  const hasVitestConfig = VITEST_CONFIG_FILES.some((fileName) =>
    tree.exists(projectPath(root, fileName))
  );
  const hasJestConfig = JEST_CONFIG_FILES.some((fileName) =>
    tree.exists(projectPath(root, fileName))
  );

  if (hasVitestConfig && hasJestConfig) {
    return 'ambiguous';
  }
  if (hasVitestConfig) {
    return 'vitest';
  }
  if (hasJestConfig) {
    return 'jest';
  }

  return undefined;
}

function detectTestRunnerFromPackageJson(
  packageJson: PackageJson | undefined
): SignalMatch<'vitest' | 'jest'> {
  if (!packageJson) {
    return undefined;
  }

  const hasVitestSignal =
    hasPackageDependency(packageJson, 'vitest') ||
    packageScriptsContain(packageJson, 'vitest');
  const hasJestSignal =
    hasPackageDependency(packageJson, 'jest') ||
    packageScriptsContain(packageJson, 'jest');

  if (hasVitestSignal && hasJestSignal) {
    return 'ambiguous';
  }
  if (hasVitestSignal) {
    return 'vitest';
  }
  if (hasJestSignal) {
    return 'jest';
  }

  return undefined;
}

function detectCompiler(
  tree: Tree,
  projectRoot: string,
  nestCliMatch: NestCliMatch,
  nearestPackageJson: PackageJson | undefined,
  nearestPackageScope: PackageSignalScope | undefined,
  workspacePackageJson: PackageJson | undefined,
  workspacePackageJsonPath: string | undefined
): 'tsc' | 'swc' | undefined {
  if (nestCliMatch.compiler === 'swc') {
    return 'swc';
  }

  if (
    nearestPackageScope === 'project' &&
    packageHasSwcSignals(nearestPackageJson)
  ) {
    return 'swc';
  }

  if (nestCliMatch.hasNestCliJson) {
    return 'tsc';
  }

  if (nearestPackageScope === 'project') {
    if (
      packageHasTypescriptSignals(nearestPackageJson) ||
      projectHasTsConfig(tree, projectRoot)
    ) {
      return 'tsc';
    }
  }

  if (!projectRoot && workspacePackageJsonPath) {
    if (
      packageHasSwcSignals(workspacePackageJson) &&
      packageHasTypescriptSignals(workspacePackageJson)
    ) {
      return 'swc';
    }

    if (
      packageHasTypescriptSignals(workspacePackageJson) ||
      projectHasTsConfig(tree, projectRoot)
    ) {
      return 'tsc';
    }
  }

  return projectHasTsConfig(tree, projectRoot) ? 'tsc' : undefined;
}

function packageHasSwcSignals(packageJson: PackageJson | undefined): boolean {
  if (!packageJson) {
    return false;
  }

  return (
    hasPackageDependency(packageJson, '@swc/core') ||
    hasPackageDependency(packageJson, '@swc/cli') ||
    packageScriptsContain(packageJson, 'swc')
  );
}

function packageHasTypescriptSignals(
  packageJson: PackageJson | undefined
): boolean {
  if (!packageJson) {
    return false;
  }

  return (
    hasPackageDependency(packageJson, 'typescript') ||
    packageScriptsContain(packageJson, 'tsc') ||
    packageScriptsContain(packageJson, 'nest build')
  );
}

function projectHasTsConfig(tree: Tree, projectRoot: string): boolean {
  return TS_CONFIG_FILES.some((fileName) =>
    tree.exists(projectPath(projectRoot, fileName))
  );
}

function packageScriptsContain(
  packageJson: PackageJson,
  needle: string
): boolean {
  return Object.values(packageJson.scripts ?? {}).some((script) =>
    script.includes(needle)
  );
}

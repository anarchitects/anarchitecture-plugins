import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  CreateNodesContextV2,
  CreateNodesResultV2,
  CreateNodesV2,
  ProjectConfiguration,
  TargetConfiguration,
} from '@nx/devkit';
import {
  createNodesFromFiles,
  getPackageManagerCommand,
  joinPathFragments,
  normalizePath,
} from '@nx/devkit';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs.js';
import { FsTree } from 'nx/src/generators/tree.js';
import { detectNestProject } from '../core/detect-nest-project.js';

export interface NestPluginOptions {
  buildTargetName?: string;
  serveTargetName?: string;
  testTargetName?: string;
  lintTargetName?: string;
}

interface NormalizedNestPluginOptions {
  buildTargetName: string;
  serveTargetName: string;
  testTargetName: string;
  lintTargetName: string;
}

const nestConfigGlob = '**/nest-cli.json';
const pmc = getPackageManagerCommand();

export const name = '@anarchitects/nest';

export const createNodes: CreateNodesV2<NestPluginOptions> = [
  nestConfigGlob,
  async (configFilePaths, options, context): Promise<CreateNodesResultV2> => {
    const normalizedOptions = normalizeOptions(options);
    const uniqueConfigFilePaths =
      dedupeConfigFilesByProjectRoot(configFilePaths);

    return (await createNodesFromFiles(
      (configFilePath) =>
        createNodesInternal(configFilePath, normalizedOptions, context),
      uniqueConfigFilePaths,
      normalizedOptions,
      context
    )) as CreateNodesResultV2;
  },
];

export const createNodesV2 = createNodes;

function normalizeOptions(
  options?: NestPluginOptions
): NormalizedNestPluginOptions {
  return {
    buildTargetName: options?.buildTargetName ?? 'build',
    serveTargetName: options?.serveTargetName ?? 'serve',
    testTargetName: options?.testTargetName ?? 'test',
    lintTargetName: options?.lintTargetName ?? 'lint',
  };
}

function dedupeConfigFilesByProjectRoot(
  configFilePaths: readonly string[]
): string[] {
  const uniqueByRoot = new Map<string, string>();

  for (const configFilePath of configFilePaths) {
    const projectRoot = projectRootOf(configFilePath);
    if (!uniqueByRoot.has(projectRoot)) {
      uniqueByRoot.set(projectRoot, configFilePath);
    }
  }

  return Array.from(uniqueByRoot.values());
}

function projectRootOf(configFilePath: string): string {
  const normalized = normalizePath(configFilePath);
  const projectRoot = dirname(normalized);

  return projectRoot === '.' ? '.' : normalizePath(projectRoot);
}

function createNodesInternal(
  configFilePath: string,
  options: NormalizedNestPluginOptions,
  context: CreateNodesContextV2
) {
  const projectRoot = projectRootOf(configFilePath);
  if (!hasProjectMarker(context.workspaceRoot, projectRoot)) {
    return { projects: {} };
  }

  const tree = new FsTree(context.workspaceRoot, false, 'nest createNodesV2');
  const detection = detectNestProject(
    tree,
    projectRoot === '.' ? '' : projectRoot
  );
  if (!detection.isNestProject) {
    return { projects: {} };
  }

  const namedInputs = getNamedInputs(projectRoot, context);
  const targets = createTargets(projectRoot, configFilePath, options, {
    namedInputs,
    testRunner: detection.testRunner,
    lintRunner: detection.lintRunner,
  });

  return {
    projects: {
      [projectRoot]: {
        root: projectRoot,
        targets,
        metadata: {
          technologies: ['nest'],
        },
      } satisfies ProjectConfiguration,
    },
  };
}

function hasProjectMarker(workspaceRoot: string, projectRoot: string): boolean {
  return (
    existsSync(join(workspaceRoot, projectRoot, 'project.json')) ||
    existsSync(join(workspaceRoot, projectRoot, 'package.json'))
  );
}

function createTargets(
  projectRoot: string,
  configFilePath: string,
  options: NormalizedNestPluginOptions,
  facts: {
    namedInputs: Record<string, unknown[]>;
    testRunner?: 'vitest' | 'jest';
    lintRunner?: 'eslint' | 'oxlint';
  }
): Record<string, TargetConfiguration> {
  const targets: Record<string, TargetConfiguration> = {
    [options.buildTargetName]: createBuildTarget(
      projectRoot,
      configFilePath,
      options.buildTargetName,
      facts.namedInputs
    ),
    [options.serveTargetName]: createServeTarget(projectRoot, configFilePath),
  };

  const testTarget = createTestTarget(projectRoot, facts.testRunner);
  if (testTarget) {
    targets[options.testTargetName] = testTarget;
  }

  const lintTarget = createLintTarget(projectRoot, facts.lintRunner);
  if (lintTarget) {
    targets[options.lintTargetName] = lintTarget;
  }

  return targets;
}

function createBuildTarget(
  projectRoot: string,
  configFilePath: string,
  buildTargetName: string,
  namedInputs: Record<string, unknown[]>
): TargetConfiguration {
  return {
    command: 'nest build',
    options: {
      cwd: joinPathFragments(projectRoot),
    },
    cache: true,
    dependsOn: [`^${buildTargetName}`],
    inputs: [
      ...getProductionOrDefaultInputs(namedInputs),
      toWorkspaceInput(configFilePath),
      { externalDependencies: ['@nestjs/cli'] },
    ],
    outputs: ['{workspaceRoot}/dist/{projectRoot}'],
    metadata: {
      technologies: ['nest'],
      description: 'Build Nest project',
      help: {
        command: `${pmc.exec} nest build --help`,
        example: {
          options: {
            watch: true,
          },
        },
      },
    },
  };
}

function createServeTarget(
  projectRoot: string,
  configFilePath: string
): TargetConfiguration {
  return {
    command: 'nest start',
    options: {
      cwd: joinPathFragments(projectRoot),
    },
    continuous: true,
    cache: false,
    inputs: [
      'default',
      '^default',
      toWorkspaceInput(configFilePath),
      { externalDependencies: ['@nestjs/cli'] },
    ],
    metadata: {
      technologies: ['nest'],
      description: 'Start Nest application',
      help: {
        command: `${pmc.exec} nest start --help`,
        example: {
          options: {
            watch: true,
          },
        },
      },
    },
  };
}

function createTestTarget(
  projectRoot: string,
  testRunner: 'vitest' | 'jest' | undefined
): TargetConfiguration | undefined {
  if (!testRunner) {
    return undefined;
  }

  const isVitest = testRunner === 'vitest';

  return {
    command: isVitest ? 'vitest run' : 'jest',
    options: {
      cwd: joinPathFragments(projectRoot),
    },
    cache: true,
    inputs: [
      'default',
      '^default',
      { externalDependencies: [isVitest ? 'vitest' : 'jest'] },
      { env: 'CI' },
    ],
    outputs: ['{workspaceRoot}/coverage/{projectRoot}'],
    metadata: {
      technologies: ['nest', testRunner],
      description: 'Run Nest tests',
      help: {
        command: `${pmc.exec} ${isVitest ? 'vitest' : 'jest'} --help`,
        example: {
          options: {
            coverage: true,
          },
        },
      },
    },
  };
}

function createLintTarget(
  projectRoot: string,
  lintRunner: 'eslint' | 'oxlint' | undefined
): TargetConfiguration | undefined {
  if (!lintRunner) {
    return undefined;
  }

  return {
    command: `${lintRunner} .`,
    options: {
      cwd: joinPathFragments(projectRoot),
    },
    cache: true,
    inputs: ['default', '^default', { externalDependencies: [lintRunner] }],
    metadata: {
      technologies: ['nest', lintRunner],
      description: 'Lint Nest project',
      help: {
        command: `${pmc.exec} ${lintRunner} --help`,
        example: {
          options: {
            quiet: true,
          },
        },
      },
    },
  };
}

function getProductionOrDefaultInputs(
  namedInputs: Record<string, unknown[]>
): string[] {
  return 'production' in namedInputs
    ? ['production', '^production']
    : ['default', '^default'];
}

function toWorkspaceInput(configFilePath: string): string {
  return joinPathFragments(
    '{workspaceRoot}',
    normalizePath(configFilePath).replace(/^\.\/+/, '')
  );
}

export default {
  name,
  createNodesV2,
};

import { logger, readJson, type Tree, updateJson } from '@nx/devkit';
import initGenerator from './generator.js';

let createTreeWithEmptyWorkspace:
  | typeof import('@nx/devkit/testing')['createTreeWithEmptyWorkspace']
  | undefined;

describe('governance initGenerator', () => {
  let tree: Tree;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    if (!createTreeWithEmptyWorkspace) {
      throw new Error('createTreeWithEmptyWorkspace was not loaded.');
    }

    tree = createTreeWithEmptyWorkspace();
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('adds the governance graph root target with the expected executor and defaults', async () => {
    await initGenerator(tree, {
      configureEslint: false,
      skipFormat: true,
    });

    const packageJson = readJson(tree, 'package.json') as {
      nx?: { targets?: Record<string, unknown> };
    };

    expect(packageJson.nx?.targets?.['governance-graph']).toEqual({
      executor: '@anarchitects/nx-governance:governance-graph',
      options: {
        format: 'html',
        outputPath: 'dist/governance/graph.html',
      },
      metadata: {
        description:
          'Generate a governance-enriched graph artifact and static HTML viewer from the Nx Project Graph.',
      },
    });
  });

  it('is idempotent and registers the plugin only once', async () => {
    await initGenerator(tree, {
      configureEslint: false,
      skipFormat: true,
    });
    const firstPackageJson = tree.read('package.json', 'utf-8');
    const firstNxJson = tree.read('nx.json', 'utf-8');

    await initGenerator(tree, {
      configureEslint: false,
      skipFormat: true,
    });

    const nxJson = readJson(tree, 'nx.json') as {
      plugins?: Array<string | { plugin?: string }>;
    };
    const governancePlugins = (nxJson.plugins ?? []).filter((entry) =>
      typeof entry === 'string'
        ? entry === '@anarchitects/nx-governance'
        : entry.plugin === '@anarchitects/nx-governance'
    );

    expect(governancePlugins).toHaveLength(1);
    expect(tree.read('package.json', 'utf-8')).toBe(firstPackageJson);
    expect(tree.read('nx.json', 'utf-8')).toBe(firstNxJson);
  });

  it('preserves existing governance graph target customizations while filling missing defaults', async () => {
    updateJson(
      tree,
      'package.json',
      (json: { nx?: { targets?: Record<string, unknown> } }) => ({
        ...json,
        nx: {
          ...(json.nx ?? {}),
          targets: {
            ...(json.nx?.targets ?? {}),
            'governance-graph': {
              executor: '@anarchitects/nx-governance:governance-graph',
              dependsOn: ['repo-health'],
              options: {
                format: 'json',
                outputPath: 'artifacts/governance-graph.json',
              },
              metadata: {
                description: 'Custom graph target.',
              },
            },
          },
        },
      })
    );

    await initGenerator(tree, {
      configureEslint: false,
      skipFormat: true,
    });

    const packageJson = readJson(tree, 'package.json') as {
      nx?: { targets?: Record<string, unknown> };
    };

    expect(packageJson.nx?.targets?.['governance-graph']).toEqual({
      executor: '@anarchitects/nx-governance:governance-graph',
      dependsOn: ['repo-health'],
      options: {
        format: 'json',
        outputPath: 'artifacts/governance-graph.json',
      },
      metadata: {
        description: 'Custom graph target.',
      },
    });
  });

  it('adds the governance graph target without removing existing governance targets', async () => {
    updateJson(
      tree,
      'package.json',
      (json: { nx?: { targets?: Record<string, unknown> } }) => ({
        ...json,
        nx: {
          ...(json.nx ?? {}),
          targets: {
            ...(json.nx?.targets ?? {}),
            'repo-health': {
              executor: '@anarchitects/nx-governance:repo-health',
              options: {
                profile: 'custom-profile',
              },
            },
          },
        },
      })
    );

    await initGenerator(tree, {
      configureEslint: false,
      skipFormat: true,
    });

    const packageJson = readJson(tree, 'package.json') as {
      nx?: { targets?: Record<string, unknown> };
    };

    expect(packageJson.nx?.targets?.['repo-health']).toEqual({
      executor: '@anarchitects/nx-governance:repo-health',
      options: {
        profile: 'custom-profile',
        output: 'cli',
      },
      metadata: {
        description: 'Run governance health assessment for the workspace.',
      },
    });
    expect(packageJson.nx?.targets?.['governance-graph']).toBeDefined();
  });
});

beforeAll(async () => {
  ({ createTreeWithEmptyWorkspace } = await import('@nx/devkit/testing'));
});

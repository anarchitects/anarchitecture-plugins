import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { logger, readJson, Tree, updateJson } from '@nx/devkit';

import { createBackendLayered3TierStarterProfile } from '../../presets/backend-layered/profile.js';
import { createBackendLayeredDddStarterProfile } from '../../presets/backend-layered/profile.js';
import { createFrontendLayeredStarterProfile } from '../../presets/frontend-layered/profile.js';
import initGenerator from './generator.js';

let createTreeWithEmptyWorkspace:
  | typeof import('@nx/devkit/testing')['createTreeWithEmptyWorkspace']
  | undefined;

const MINIMAL_TARGET_NAMES = ['repo-health', 'governance-graph'] as const;
const FULL_ONLY_TARGET_NAMES = [
  'repo-boundaries',
  'repo-ownership',
  'repo-architecture',
  'repo-snapshot',
  'repo-drift',
  'workspace-graph',
  'workspace-conformance',
  'repo-ai-root-cause',
  'repo-ai-drift',
  'repo-ai-pr-impact',
  'repo-ai-cognitive-load',
  'repo-ai-recommendations',
  'repo-ai-smell-clusters',
  'repo-ai-refactoring-suggestions',
  'repo-ai-scorecard',
  'repo-ai-onboarding',
] as const;
const FULL_TARGET_NAMES = [
  ...MINIMAL_TARGET_NAMES,
  ...FULL_ONLY_TARGET_NAMES,
] as const;
const AI_TARGET_NAMES = [
  'repo-ai-root-cause',
  'repo-ai-drift',
  'repo-ai-pr-impact',
  'repo-ai-cognitive-load',
  'repo-ai-recommendations',
  'repo-ai-smell-clusters',
  'repo-ai-refactoring-suggestions',
  'repo-ai-scorecard',
  'repo-ai-onboarding',
] as const;
const SUPPORT_TARGET_NAMES = [
  'repo-snapshot',
  'repo-drift',
  'workspace-graph',
  'workspace-conformance',
] as const;

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

  it('defaults to the minimal repo-health-plus-governance-graph target preset', async () => {
    await initGenerator(tree, {
      configureEslint: false,
      skipFormat: true,
    });

    const targets = readTargets(tree);

    expect(Object.keys(targets).sort()).toEqual(
      [...MINIMAL_TARGET_NAMES].sort()
    );
    expect(targets['repo-health']).toEqual({
      executor: '@anarchitects/nx-governance:repo-health',
      options: {
        profile: 'frontend-layered',
        output: 'cli',
      },
      metadata: {
        description: 'Run governance health assessment for the workspace.',
      },
    });
    expect(targets['governance-graph']).toEqual({
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

    for (const targetName of FULL_ONLY_TARGET_NAMES) {
      expect(targets[targetName]).toBeUndefined();
    }

    for (const targetName of AI_TARGET_NAMES) {
      expect(targets[targetName]).toBeUndefined();
    }

    for (const targetName of SUPPORT_TARGET_NAMES) {
      expect(targets[targetName]).toBeUndefined();
    }
  });

  it('uses frontend-layered by default and seeds only that starter profile output', async () => {
    await initGenerator(tree, {
      configureEslint: false,
      skipFormat: true,
    });

    const targets = readTargets(tree);

    expect(targets['repo-health']?.options).toEqual({
      profile: 'frontend-layered',
      output: 'cli',
    });
    expect(targets['governance-graph']?.options).toEqual({
      format: 'html',
      outputPath: 'dist/governance/graph.html',
    });
    expect(
      readJson(tree, 'tools/governance/profiles/frontend-layered.json')
    ).toEqual(createFrontendLayeredStarterProfile());
    expect(
      tree.exists('tools/governance/profiles/backend-layered-3tier.json')
    ).toBe(false);
    expect(
      tree.exists('tools/governance/profiles/backend-layered-ddd.json')
    ).toBe(false);
  });

  it('keeps writing explicit minimal targets even when the seeded profile also enables Project Crystal inference', async () => {
    await initGenerator(tree, {
      configureEslint: false,
      skipFormat: true,
    });

    expect(tree.exists('tools/governance/profiles/frontend-layered.json')).toBe(
      true
    );
    expect(readTargets(tree)['repo-health']).toEqual({
      executor: '@anarchitects/nx-governance:repo-health',
      options: {
        profile: 'frontend-layered',
        output: 'cli',
      },
      metadata: {
        description: 'Run governance health assessment for the workspace.',
      },
    });
    expect(readTargets(tree)['governance-graph']).toEqual({
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

  it('supports multiple preset selections and uses the first selected preset as the default runtime profile', async () => {
    await initGenerator(tree, {
      configureEslint: false,
      preset: ['frontend-layered', 'backend-layered-3tier'],
      skipFormat: true,
    });

    const targets = readTargets(tree);

    expect(targets['repo-health']?.options).toEqual({
      profile: 'frontend-layered',
      output: 'cli',
    });
    expect(
      readJson(tree, 'tools/governance/profiles/frontend-layered.json')
    ).toEqual(createFrontendLayeredStarterProfile());
    expect(
      readJson(tree, 'tools/governance/profiles/backend-layered-3tier.json')
    ).toEqual(createBackendLayered3TierStarterProfile());
  });

  it('supports explicitly requesting the minimal target preset', async () => {
    await initGenerator(tree, {
      configureEslint: false,
      targetPreset: 'minimal',
      skipFormat: true,
    });

    expect(Object.keys(readTargets(tree)).sort()).toEqual(
      [...MINIMAL_TARGET_NAMES].sort()
    );
  });

  it('supports requesting the full target preset with the previous broad target surface', async () => {
    await initGenerator(tree, {
      configureEslint: false,
      targetPreset: 'full',
      skipFormat: true,
    });

    const targets = readTargets(tree);

    expect(Object.keys(targets).sort()).toEqual([...FULL_TARGET_NAMES].sort());
    expect(targets['governance-graph']).toEqual({
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
    expect(targets['repo-ai-onboarding']).toBeDefined();
    expect(targets['repo-snapshot']).toBeDefined();
    expect(targets['repo-drift']).toBeDefined();
    expect(targets['workspace-graph']).toBeDefined();
    expect(targets['workspace-conformance']).toBeDefined();
  });

  it('seeds backend-layered-3tier when selected explicitly', async () => {
    await initGenerator(tree, {
      configureEslint: false,
      preset: ['backend-layered-3tier'],
      skipFormat: true,
    });

    const targets = readTargets(tree);

    expect(targets['repo-health']?.options).toEqual({
      profile: 'backend-layered-3tier',
      output: 'cli',
    });
    expect(
      readJson(tree, 'tools/governance/profiles/backend-layered-3tier.json')
    ).toEqual(createBackendLayered3TierStarterProfile());
    expect(tree.exists('tools/governance/profiles/frontend-layered.json')).toBe(
      false
    );
  });

  it('seeds backend-layered-ddd when selected explicitly', async () => {
    await initGenerator(tree, {
      configureEslint: false,
      preset: ['backend-layered-ddd'],
      skipFormat: true,
    });

    const targets = readTargets(tree);

    expect(targets['repo-health']?.options).toEqual({
      profile: 'backend-layered-ddd',
      output: 'cli',
    });
    expect(
      readJson(tree, 'tools/governance/profiles/backend-layered-ddd.json')
    ).toEqual(createBackendLayeredDddStarterProfile());
    expect(tree.exists('tools/governance/profiles/frontend-layered.json')).toBe(
      false
    );
  });

  it('supports a custom profile name while seeding the selected starter preset', async () => {
    await initGenerator(tree, {
      configureEslint: false,
      preset: ['frontend-layered', 'backend-layered-ddd'],
      profile: 'workspace-policy',
      targetPreset: 'full',
      skipFormat: true,
    });

    const targets = readTargets(tree);

    expect(targets['repo-health']?.options).toEqual({
      profile: 'workspace-policy',
      output: 'cli',
    });
    expect(
      readJson(tree, 'tools/governance/profiles/workspace-policy.json')
    ).toEqual(createFrontendLayeredStarterProfile());
    expect(
      readJson(tree, 'tools/governance/profiles/backend-layered-ddd.json')
    ).toEqual(createBackendLayeredDddStarterProfile());
  });

  it('uses an explicit built-in profile with multi-select presets for generated root targets', async () => {
    await initGenerator(tree, {
      configureEslint: false,
      preset: ['frontend-layered', 'backend-layered-ddd'],
      profile: 'backend-layered-ddd',
      skipFormat: true,
    });

    const targets = readTargets(tree);

    expect(targets['repo-health']?.options).toEqual({
      profile: 'backend-layered-ddd',
      output: 'cli',
    });
    expect(
      readJson(tree, 'tools/governance/profiles/frontend-layered.json')
    ).toEqual(createFrontendLayeredStarterProfile());
    expect(
      readJson(tree, 'tools/governance/profiles/backend-layered-ddd.json')
    ).toEqual(createBackendLayeredDddStarterProfile());
  });

  it('rejects mutually exclusive backend starter presets', async () => {
    await expect(
      initGenerator(tree, {
        configureEslint: false,
        preset: ['backend-layered-3tier', 'backend-layered-ddd'],
        skipFormat: true,
      })
    ).rejects.toThrow(
      'backend-layered-3tier and backend-layered-ddd are mutually exclusive. Choose one backend architecture preset.'
    );
  });

  it('rejects mutually exclusive backend selections across preset and profile', async () => {
    await expect(
      initGenerator(tree, {
        configureEslint: false,
        preset: ['backend-layered-3tier'],
        profile: 'backend-layered-ddd',
        skipFormat: true,
      })
    ).rejects.toThrow(
      'backend-layered-3tier and backend-layered-ddd are mutually exclusive. Choose one backend architecture preset.'
    );
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

  it('preserves an existing governance-graph target when minimal init runs', async () => {
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
      targetPreset: 'minimal',
      skipFormat: true,
    });

    expect(readTargets(tree)['governance-graph']).toEqual({
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

  it('preserves existing governance targets and target options while filling missing defaults in minimal mode', async () => {
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
            'repo-ai-scorecard': {
              executor: '@anarchitects/nx-governance:repo-ai-scorecard',
              options: {
                profile: 'custom-profile',
                output: 'json',
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

    const targets = readTargets(tree);

    expect(targets['repo-health']).toEqual({
      executor: '@anarchitects/nx-governance:repo-health',
      options: {
        profile: 'custom-profile',
        output: 'cli',
      },
      metadata: {
        description: 'Run governance health assessment for the workspace.',
      },
    });
    expect(targets['repo-ai-scorecard']).toEqual({
      executor: '@anarchitects/nx-governance:repo-ai-scorecard',
      options: {
        profile: 'custom-profile',
        output: 'json',
      },
    });
  });

  it('preserves an existing selected runtime profile file instead of overwriting it', async () => {
    const existingProfile = {
      boundaryPolicySource: 'profile',
      layers: ['domain', 'shared'],
      projectOverrides: {
        checkout: {
          documentation: true,
        },
      },
    };

    tree.write(
      'tools/governance/profiles/backend-layered-ddd.json',
      `${JSON.stringify(existingProfile, null, 2)}\n`
    );

    await initGenerator(tree, {
      configureEslint: false,
      preset: ['backend-layered-ddd'],
      skipFormat: true,
    });

    expect(
      JSON.parse(
        tree.read(
          'tools/governance/profiles/backend-layered-ddd.json',
          'utf-8'
        ) ?? 'null'
      )
    ).toEqual(existingProfile);
  });

  it('does not remove existing optional targets when minimal init runs', async () => {
    updateJson(
      tree,
      'package.json',
      (json: { nx?: { targets?: Record<string, unknown> } }) => ({
        ...json,
        nx: {
          ...(json.nx ?? {}),
          targets: {
            ...(json.nx?.targets ?? {}),
            'workspace-conformance': {
              executor: '@anarchitects/nx-governance:workspace-conformance',
              options: {
                conformanceJson: 'custom-conformance.json',
              },
            },
          },
        },
      })
    );

    await initGenerator(tree, {
      configureEslint: false,
      targetPreset: 'minimal',
      skipFormat: true,
    });

    const targets = readTargets(tree);

    expect(targets['workspace-conformance']).toEqual({
      executor: '@anarchitects/nx-governance:workspace-conformance',
      options: {
        conformanceJson: 'custom-conformance.json',
      },
    });
    expect(targets['repo-health']).toBeDefined();
    expect(targets['governance-graph']).toEqual({
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

  it('handles a missing package.json by creating the root governance target surface', async () => {
    tree.delete('package.json');

    await initGenerator(tree, {
      configureEslint: false,
      skipFormat: true,
    });

    expect(readTargets(tree)['repo-health']).toBeDefined();
  });

  it('exposes the targetPreset enum in the init schema', () => {
    const schema = readSchema();

    expect(schema.properties?.targetPreset).toEqual({
      type: 'string',
      enum: ['minimal', 'full'],
      default: 'minimal',
      description:
        'Controls which root governance targets the init generator writes. Use "minimal" for the default repo-health plus governance-graph surface, or "full" to restore the broader governance, diagnostic, snapshot/drift, and AI target set.',
      'x-prompt': 'Select the governance root target preset to generate.',
    });
  });

  it('exposes the starter preset option in the init schema', () => {
    const schema = readSchema();

    expect(schema.properties?.preset).toEqual({
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'frontend-layered',
          'backend-layered-3tier',
          'backend-layered-ddd',
        ],
      },
      uniqueItems: true,
      default: ['frontend-layered'],
      description:
        'Built-in governance starter presets to seed when init creates missing profile files. When profile is omitted, the first selected preset becomes the default runtime profile for generated root targets. backend-layered-3tier and backend-layered-ddd are mutually exclusive.',
      'x-prompt':
        'Select one or more built-in governance starter presets to seed.',
    });
    expect(schema.properties?.profile?.type).toBe('string');
  });

  it('does not reintroduce angular-cleanup in generated targets, profiles, or schema', async () => {
    await initGenerator(tree, {
      configureEslint: false,
      targetPreset: 'full',
      skipFormat: true,
    });

    expect(tree.exists('tools/governance/profiles/angular-cleanup.json')).toBe(
      false
    );
    expect(JSON.stringify(readTargets(tree))).not.toContain('angular-cleanup');
    expect(
      tree.read('tools/governance/profiles/frontend-layered.json', 'utf8') ?? ''
    ).not.toContain('angular-cleanup');
    expect(JSON.stringify(readSchema())).not.toContain('angular-cleanup');
  });

  it('documents HTML graph generation in the README', () => {
    const readme = readGovernanceReadme();

    expect(readme).toContain('nx governance-graph');
    expect(readme).toContain('dist/governance/graph.html');
    expect(readme).toContain('format: html');
  });

  it('documents JSON graph generation through executor options in the README', () => {
    const readme = readGovernanceReadme();

    expect(readme).toContain(
      'nx governance-graph --format=json --outputPath=dist/governance/graph.json'
    );
    expect(readme).toContain('dist/governance/graph.json');
  });
});

function readSchema(): {
  properties?: Record<string, Record<string, unknown>>;
} {
  const schemaPath = join(__dirname, 'schema.json');

  return JSON.parse(readFileSync(schemaPath, 'utf-8')) as {
    properties?: Record<string, Record<string, unknown>>;
  };
}

function readGovernanceReadme(): string {
  return readFileSync(join(__dirname, '../../../README.md'), 'utf-8');
}

interface RootTargetConfig {
  options?: Record<string, unknown>;
  [key: string]: unknown;
}

function readTargets(tree: Tree): Record<string, RootTargetConfig> {
  const packageJson = readJson(tree, 'package.json') as {
    nx?: { targets?: Record<string, RootTargetConfig> };
  };

  return packageJson.nx?.targets ?? {};
}

beforeAll(async () => {
  ({ createTreeWithEmptyWorkspace } = await import('@nx/devkit/testing'));
});

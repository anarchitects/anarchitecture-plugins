import type { CreateNodesContextV2, CreateNodesResultV2 } from '@nx/devkit';

import { createNodesV2 } from './index.js';

describe('governance plugin createNodesV2', () => {
  const createNodes = createNodesV2[1];
  const context: CreateNodesContextV2 = {
    workspaceRoot: '/workspace',
    nxJsonConfiguration: {} as CreateNodesContextV2['nxJsonConfiguration'],
  };

  it('infers the four core governance targets for a single profile file', async () => {
    const results = await createNodes(
      ['tools/governance/profiles/backend-layered-ddd.json'],
      undefined,
      context
    );

    expect(collectTargets(results)).toEqual({
      'repo-health': expect.objectContaining({
        executor: '@anarchitects/nx-governance:repo-health',
        cache: true,
        inputs: [
          'default',
          '{workspaceRoot}/tools/governance/**/*',
          '{workspaceRoot}/nx.json',
        ],
        outputs: [],
        options: {
          profile: 'backend-layered-ddd',
          output: 'cli',
        },
      }),
      'repo-boundaries': expect.objectContaining({
        executor: '@anarchitects/nx-governance:repo-boundaries',
        options: {
          profile: 'backend-layered-ddd',
          output: 'cli',
        },
      }),
      'repo-ownership': expect.objectContaining({
        executor: '@anarchitects/nx-governance:repo-ownership',
        options: {
          profile: 'backend-layered-ddd',
          output: 'cli',
        },
      }),
      'repo-architecture': expect.objectContaining({
        executor: '@anarchitects/nx-governance:repo-architecture',
        options: {
          profile: 'backend-layered-ddd',
          output: 'cli',
        },
      }),
    });
    expect(collectTargets(results)['governance-graph']).toBeUndefined();
  });

  it('prefers frontend-layered when multiple profiles exist', async () => {
    const results = await createNodes(
      [
        'tools/governance/profiles/backend-layered-ddd.json',
        'tools/governance/profiles/frontend-layered.json',
      ],
      undefined,
      context
    );

    expect(collectTargets(results)['repo-health']?.options).toEqual({
      profile: 'frontend-layered',
      output: 'cli',
    });
  });

  it('falls back to lexical-first profile name when frontend-layered is absent', async () => {
    const results = await createNodes(
      [
        'tools/governance/profiles/z-team.json',
        'tools/governance/profiles/a-team.json',
      ],
      undefined,
      context
    );

    expect(collectTargets(results)['repo-health']?.options).toEqual({
      profile: 'a-team',
      output: 'cli',
    });
  });

  it('supports profileGlob as a narrowing filter over discovered profile files', async () => {
    const results = await createNodes(
      [
        'tools/governance/profiles/frontend-layered.json',
        'tools/governance/profiles/backend-layered-ddd.json',
      ],
      {
        profileGlob: 'tools/governance/profiles/backend-*.json',
      },
      context
    );

    expect(collectTargets(results)['repo-health']?.options).toEqual({
      profile: 'backend-layered-ddd',
      output: 'cli',
    });
  });

  it('returns no inferred targets when no profiles match the configured glob', async () => {
    const results = await createNodes(
      ['tools/governance/profiles/frontend-layered.json'],
      {
        profileGlob: 'tools/governance/profiles/backend-*.json',
      },
      context
    );

    expect(results).toEqual([]);
  });

  it('keeps unknown profile names deterministic without inventing new target names', async () => {
    const results = await createNodes(
      ['tools/governance/profiles/custom-team.json'],
      undefined,
      context
    );

    expect(Object.keys(collectTargets(results))).toEqual([
      'repo-health',
      'repo-boundaries',
      'repo-ownership',
      'repo-architecture',
    ]);
    expect(collectTargets(results)['repo-health']?.options).toEqual({
      profile: 'custom-team',
      output: 'cli',
    });
  });

  it('preserves explicit-only governance target options without requiring inference', async () => {
    const mergedTargets = await mergeTargets(
      {},
      {
        'governance-graph': {
          executor: '@anarchitects/nx-governance:governance-graph',
          options: {
            profile: 'custom-graph',
            format: 'json',
            outputPath: 'dist/custom/governance-graph.json',
          },
          metadata: {
            description: 'Explicit graph target.',
          },
        },
      }
    );

    expect(mergedTargets['governance-graph']).toEqual({
      executor: '@anarchitects/nx-governance:governance-graph',
      options: {
        profile: 'custom-graph',
        format: 'json',
        outputPath: 'dist/custom/governance-graph.json',
      },
      metadata: {
        description: 'Explicit graph target.',
      },
    });
  });

  it('keeps explicit repo-health configuration authoritative when the same target is also inferred', async () => {
    const results = await createNodes(
      ['tools/governance/profiles/frontend-layered.json'],
      undefined,
      context
    );

    const mergedTargets = await mergeTargets(collectTargets(results), {
      'repo-health': {
        executor: '@anarchitects/nx-governance:repo-health',
        options: {
          profile: 'custom-health',
          output: 'json',
          failOnViolation: true,
        },
        metadata: {
          description: 'Explicit health target.',
        },
      },
    });

    expect(mergedTargets['repo-health']).toEqual({
      executor: '@anarchitects/nx-governance:repo-health',
      cache: true,
      inputs: [
        'default',
        '{workspaceRoot}/tools/governance/**/*',
        '{workspaceRoot}/nx.json',
      ],
      outputs: [],
      options: {
        profile: 'custom-health',
        output: 'json',
        failOnViolation: true,
      },
      metadata: {
        description: 'Explicit health target.',
      },
    });
    expect(mergedTargets['repo-boundaries']?.options).toEqual({
      profile: 'frontend-layered',
      output: 'cli',
    });
  });

  it('keeps explicit governance-graph targets alongside inferred core targets because graph inference is disabled', async () => {
    const results = await createNodes(
      ['tools/governance/profiles/frontend-layered.json'],
      undefined,
      context
    );

    const mergedTargets = await mergeTargets(collectTargets(results), {
      'governance-graph': {
        executor: '@anarchitects/nx-governance:governance-graph',
        options: {
          format: 'html',
          outputPath: 'dist/governance/graph.html',
        },
      },
    });

    expect(mergedTargets['governance-graph']).toEqual({
      executor: '@anarchitects/nx-governance:governance-graph',
      options: {
        format: 'html',
        outputPath: 'dist/governance/graph.html',
      },
    });
    expect(Object.keys(mergedTargets)).toEqual(
      expect.arrayContaining([
        'repo-health',
        'repo-boundaries',
        'repo-ownership',
        'repo-architecture',
        'governance-graph',
      ])
    );
  });
});

function collectTargets(
  results: CreateNodesResultV2
): Record<string, Record<string, unknown>> {
  const collected: Record<string, Record<string, unknown>> = {};

  for (const [, result] of results) {
    const targets = result.projects?.['.']?.targets ?? {};

    for (const [targetName, targetConfig] of Object.entries(targets)) {
      collected[targetName] = targetConfig as Record<string, unknown>;
    }
  }

  return collected;
}

async function mergeTargets(
  inferredTargets: Record<string, Record<string, unknown>>,
  explicitTargets: Record<string, Record<string, unknown>>
): Promise<Record<string, Record<string, unknown>>> {
  const { mergeProjectConfigurationIntoRootMap } = await import(
    'nx/src/project-graph/utils/project-configuration-utils'
  );
  const projectRootMap: Record<
    string,
    {
      name?: string;
      root: string;
      targets?: Record<string, Record<string, unknown>>;
    }
  > = {};

  mergeProjectConfigurationIntoRootMap(
    projectRootMap,
    {
      root: '.',
      name: '@anarchitecture-plugins/source',
      targets: inferredTargets,
    },
    undefined,
    ['tools/governance/profiles/frontend-layered.json', 'governance-inference']
  );
  mergeProjectConfigurationIntoRootMap(
    projectRootMap,
    {
      root: '.',
      name: '@anarchitecture-plugins/source',
      targets: explicitTargets,
    },
    undefined,
    ['package.json', 'package-json']
  );

  return projectRootMap['.']?.targets ?? {};
}

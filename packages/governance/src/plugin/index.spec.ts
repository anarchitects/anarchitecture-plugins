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

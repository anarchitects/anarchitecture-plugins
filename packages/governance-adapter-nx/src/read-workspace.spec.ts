import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { GovernanceWorkspaceAdapterResult } from '@anarchitects/governance-core';

import {
  createNxWorkspaceAdapterResult,
  discoverGovernanceProfileFiles,
  resolveProjectTagsAndMetadata,
} from './read-workspace.js';
import type { AdapterWorkspaceSnapshot } from './types.js';

describe('read-workspace adapter compatibility', () => {
  let testRoot: string;

  beforeEach(() => {
    testRoot = join(tmpdir(), `nx-governance-read-workspace-${Date.now()}`);
    mkdirSync(testRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('reads tags and metadata from project.json when package nx config is absent', () => {
    const projectRoot = 'libs/orders';
    const absProjectRoot = join(testRoot, projectRoot);
    mkdirSync(absProjectRoot, { recursive: true });

    writeFileSync(
      join(absProjectRoot, 'project.json'),
      JSON.stringify(
        {
          name: 'orders',
          tags: ['domain:orders', 'layer:feature'],
          metadata: {
            ownership: {
              team: '@org/orders',
            },
            documentation: true,
          },
        },
        null,
        2
      )
    );

    const result = resolveProjectTagsAndMetadata(projectRoot, testRoot);

    expect(result.tags).toEqual(['domain:orders', 'layer:feature']);
    expect(result.metadata).toEqual({
      ownership: {
        team: '@org/orders',
      },
      documentation: true,
    });
  });

  it('merges package.json nx, project.json, and graph values deterministically', () => {
    const projectRoot = 'libs/shared';
    const absProjectRoot = join(testRoot, projectRoot);
    mkdirSync(absProjectRoot, { recursive: true });

    writeFileSync(
      join(absProjectRoot, 'package.json'),
      JSON.stringify(
        {
          name: '@test/shared',
          nx: {
            tags: ['domain:shared'],
            metadata: {
              ownership: {
                team: '@org/shared-from-package',
              },
              documentation: true,
            },
          },
        },
        null,
        2
      )
    );

    writeFileSync(
      join(absProjectRoot, 'project.json'),
      JSON.stringify(
        {
          name: 'shared',
          tags: ['layer:util'],
          metadata: {
            ownership: {
              team: '@org/shared-from-project-json',
            },
          },
        },
        null,
        2
      )
    );

    const result = resolveProjectTagsAndMetadata(
      projectRoot,
      testRoot,
      ['domain:graph-derived'],
      {
        documentation: false,
        source: 'graph',
      }
    );

    expect(result.tags).toEqual([
      'domain:shared',
      'layer:util',
      'domain:graph-derived',
    ]);
    expect(result.metadata).toEqual({
      ownership: {
        team: '@org/shared-from-project-json',
      },
      documentation: false,
      source: 'graph',
    });
  });

  it('creates a Governance Core-compatible adapter result from a snapshot seam', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'booking-ui',
          root: 'libs/booking/ui',
          type: 'library',
          tags: ['scope:booking', 'layer:ui'],
          targets: ['build', 'test'],
          metadata: {
            documentation: true,
          },
        },
      ],
      dependencies: [],
      codeownersByProject: {
        'booking-ui': ['@booking-team'],
      },
    };

    const result = createNxWorkspaceAdapterResult(snapshot);
    const typedResult: GovernanceWorkspaceAdapterResult = result;

    expect(typedResult.projects).toEqual([
      {
        id: 'booking-ui',
        name: 'booking-ui',
        root: 'libs/booking/ui',
        type: 'library',
        tags: ['scope:booking', 'layer:ui'],
        metadata: {
          documentation: true,
        },
        ownership: {
          contacts: ['@booking-team'],
          source: 'codeowners',
        },
      },
    ]);
    expect(typedResult.dependencies).toEqual([]);
    expect(typedResult.nodes).toEqual([
      {
        id: 'booking-ui',
        name: 'booking-ui',
        kind: 'project',
        sourceSystem: 'nx',
        root: 'libs/booking/ui',
        path: 'libs/booking/ui',
        tags: ['scope:booking', 'layer:ui'],
        classification: {
          layer: 'ui',
          scope: 'booking',
          tags: ['scope:booking', 'layer:ui'],
        },
        metadata: {
          documentation: true,
          nx: {
            projectType: 'library',
            targets: ['build', 'test'],
          },
        },
        ownership: {
          contacts: ['@booking-team'],
          source: 'codeowners',
        },
      },
    ]);
    expect(typedResult.relations).toEqual([]);
    expect(typedResult.capabilities).toEqual(
      expect.arrayContaining([
        {
          id: 'capability:nx',
          data: {
            workspaceRoot: '/workspace',
            projects: [
              {
                name: 'booking-ui',
                root: 'libs/booking/ui',
                type: 'library',
                tags: ['scope:booking', 'layer:ui'],
                targets: ['build', 'test'],
              },
            ],
          },
        },
        {
          id: 'nx.project-graph',
          source: 'governance-adapter-nx',
          data: {
            workspaceRoot: '/workspace',
            projectCount: 1,
            projects: [
              {
                id: 'booking-ui',
                name: 'booking-ui',
                root: 'libs/booking/ui',
                type: 'library',
              },
            ],
          },
          metadata: {
            sourceSystem: 'nx',
          },
        },
      ])
    );
    expect(
      typedResult.capabilities?.map((capability) => capability.id)
    ).toEqual([
      'capability:nx',
      'nx.dependency-graph',
      'nx.inferred-targets',
      'nx.ownership-evidence',
      'nx.project-graph',
      'nx.project-metadata',
      'nx.project-tags',
      'nx.targets',
    ]);
  });

  it('discovers governance profile files without requiring host composition', () => {
    mkdirSync(join(testRoot, 'tools/governance/profiles'), {
      recursive: true,
    });
    writeFileSync(
      join(testRoot, 'tools/governance/profiles/z-profile.json'),
      '{}'
    );
    writeFileSync(
      join(testRoot, 'tools/governance/profiles/frontend-layered.json'),
      '{}'
    );
    writeFileSync(
      join(testRoot, 'tools/governance/profiles/readme.txt'),
      'not a profile'
    );

    expect(discoverGovernanceProfileFiles(testRoot)).toEqual([
      'tools/governance/profiles/frontend-layered.json',
      'tools/governance/profiles/z-profile.json',
    ]);
  });
});

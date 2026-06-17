import type { GovernanceWorkspaceAdapterResult } from '@anarchitects/governance-core';

import type { AdapterWorkspaceSnapshot } from './types.js';
import {
  buildNxGovernanceNodeId,
  buildNxGovernanceRelationId,
  toGovernanceWorkspaceAdapterResult,
} from './to-governance-workspace-adapter-result.js';

describe('toGovernanceWorkspaceAdapterResult', () => {
  it('maps nx snapshot data into canonical nodes and relations only', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'booking-ui',
          root: 'libs/booking/ui',
          sourceRoot: 'libs/booking/ui/src',
          type: 'library',
          tags: ['scope:booking', 'layer:ui', 'type:ui'],
          nxTags: ['scope:booking', 'layer:ui', 'type:ui'],
          targets: ['test', 'build'],
          implicitDependencies: ['booking-domain'],
          metadata: {
            documentation: true,
          },
        },
        {
          name: 'booking-domain',
          root: 'libs/booking/domain',
          sourceRoot: 'libs/booking/domain/src',
          type: 'library',
          tags: ['scope:booking', 'layer:domain', 'type:domain'],
          nxTags: ['scope:booking', 'layer:domain', 'type:domain'],
          targets: ['lint'],
          metadata: {
            ownership: {
              team: 'booking-team',
            },
          },
        },
      ],
      dependencies: [
        {
          source: 'booking-ui',
          target: 'booking-domain',
          type: 'static',
          sourceFile: 'libs/booking/ui/src/lib/ui.ts',
          metadata: {
            externalNodes: false,
          },
        },
      ],
      codeownersByProject: {
        'booking-domain': ['@booking-team'],
      },
    };

    const result: GovernanceWorkspaceAdapterResult =
      toGovernanceWorkspaceAdapterResult(snapshot);

    expect(result).toEqual({
      workspaceRoot: '/workspace',
      metadata: {
        sourceSystem: 'nx',
      },
      nodes: [
        {
          id: 'booking-domain',
          name: 'booking-domain',
          kind: 'project',
          sourceSystem: 'nx',
          root: 'libs/booking/domain',
          path: 'libs/booking/domain',
          tags: ['scope:booking', 'layer:domain', 'type:domain'],
          classification: {
            layer: 'domain',
            scope: 'booking',
            tags: ['scope:booking', 'layer:domain', 'type:domain'],
          },
          metadata: {
            nx: {
              projectType: 'library',
              root: 'libs/booking/domain',
              sourceRoot: 'libs/booking/domain/src',
              tags: ['scope:booking', 'layer:domain', 'type:domain'],
              targets: ['lint'],
              projectMetadata: {
                ownership: {
                  team: 'booking-team',
                },
              },
            },
          },
          ownership: {
            team: 'booking-team',
            contacts: ['@booking-team'],
            source: 'merged',
          },
        },
        {
          id: 'booking-ui',
          name: 'booking-ui',
          kind: 'project',
          sourceSystem: 'nx',
          root: 'libs/booking/ui',
          path: 'libs/booking/ui',
          tags: ['scope:booking', 'layer:ui', 'type:ui'],
          classification: {
            layer: 'ui',
            scope: 'booking',
            tags: ['scope:booking', 'layer:ui', 'type:ui'],
          },
          metadata: {
            nx: {
              projectType: 'library',
              root: 'libs/booking/ui',
              sourceRoot: 'libs/booking/ui/src',
              tags: ['scope:booking', 'layer:ui', 'type:ui'],
              targets: ['test', 'build'],
              implicitDependencies: ['booking-domain'],
              projectMetadata: {
                documentation: true,
              },
            },
          },
        },
      ],
      relations: [
        {
          id: 'nx:booking-ui->booking-domain:static:libs/booking/ui/src/lib/ui.ts',
          sourceNodeId: 'booking-ui',
          targetNodeId: 'booking-domain',
          kind: 'dependency',
          metadata: {
            nx: {
              dependencyType: 'static',
              sourceFile: 'libs/booking/ui/src/lib/ui.ts',
              externalNodes: false,
            },
          },
        },
      ],
      capabilities: expect.arrayContaining([
        {
          id: 'capability:nx',
          data: {
            workspaceRoot: '/workspace',
            projects: [
              {
                name: 'booking-domain',
                root: 'libs/booking/domain',
                type: 'library',
                tags: ['scope:booking', 'layer:domain', 'type:domain'],
                targets: ['lint'],
              },
              {
                name: 'booking-ui',
                root: 'libs/booking/ui',
                type: 'library',
                tags: ['scope:booking', 'layer:ui', 'type:ui'],
                targets: ['build', 'test'],
              },
            ],
          },
        },
        {
          id: 'nx.dependency-graph',
          source: 'governance-adapter-nx',
          data: {
            dependencyCount: 1,
            dependencies: [
              {
                sourceProjectId: 'booking-ui',
                targetProjectId: 'booking-domain',
                type: 'static',
                sourceFile: 'libs/booking/ui/src/lib/ui.ts',
              },
            ],
          },
          metadata: {
            sourceSystem: 'nx',
          },
        },
        {
          id: 'nx.project-graph',
          source: 'governance-adapter-nx',
          data: {
            workspaceRoot: '/workspace',
            projectCount: 2,
            projects: [
              {
                id: 'booking-domain',
                name: 'booking-domain',
                root: 'libs/booking/domain',
                type: 'library',
              },
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
      ]),
    });
    expect(result).not.toHaveProperty('projects');
    expect(result).not.toHaveProperty('dependencies');
    expect(result.capabilities?.map((capability) => capability.id)).toEqual([
      'capability:nx',
      'capability:ownership',
      'nx.dependency-graph',
      'nx.inferred-targets',
      'nx.ownership-evidence',
      'nx.project-graph',
      'nx.project-metadata',
      'nx.project-tags',
      'nx.targets',
    ]);
  });

  it('keeps inferred npm tags out of canonical node tags while preserving them in Nx metadata', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'booking-app',
          root: 'apps/booking',
          type: 'application',
          tags: ['domain:booking', 'layer:application'],
          nxTags: ['domain:booking', 'layer:application', 'npm:private'],
          targets: [],
          metadata: {},
        },
      ],
      dependencies: [],
      codeownersByProject: {},
    };

    const result = toGovernanceWorkspaceAdapterResult(snapshot);

    expect(result.nodes).toEqual([
      expect.objectContaining({
        id: 'booking-app',
        tags: ['domain:booking', 'layer:application'],
        classification: {
          domain: 'booking',
          layer: 'application',
          tags: ['domain:booking', 'layer:application'],
        },
        metadata: {
          nx: expect.objectContaining({
            tags: ['domain:booking', 'layer:application', 'npm:private'],
          }),
        },
      }),
    ]);
  });

  it('keeps generic tags canonical while not deriving classification from them alone', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'api',
          root: 'apps/api',
          type: 'application',
          tags: ['type: api'],
          nxTags: ['type: api'],
          targets: [],
          metadata: {},
        },
      ],
      dependencies: [],
      codeownersByProject: {},
    };

    const result = toGovernanceWorkspaceAdapterResult(snapshot);

    expect(result.nodes).toEqual([
      expect.objectContaining({
        id: 'api',
        tags: ['type: api'],
        metadata: {
          nx: expect.objectContaining({
            tags: ['type: api'],
          }),
        },
      }),
    ]);
    expect(result.nodes?.[0]?.classification).toEqual({
      tags: ['type: api'],
    });
  });

  it('uses project metadata ownership when CODEOWNERS ownership is absent', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'payments-domain',
          root: 'libs/payments/domain',
          type: 'library',
          tags: ['scope:payments', 'layer:domain'],
          targets: [],
          metadata: {
            ownership: {
              team: '@payments',
              contacts: ['@payments-oncall'],
              source: 'project-json',
            },
          },
        },
      ],
      dependencies: [],
      codeownersByProject: {},
    };

    const result = toGovernanceWorkspaceAdapterResult(snapshot);

    expect(result.nodes).toEqual([
      expect.objectContaining({
        id: 'payments-domain',
        ownership: {
          team: '@payments',
          contacts: ['@payments-oncall'],
          source: 'project-json',
        },
      }),
    ]);
  });

  it('maps the full canonical ownership shape from project metadata', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'platform-domain',
          root: 'libs/platform/domain',
          type: 'library',
          tags: ['scope:platform', 'layer:domain'],
          targets: [],
          metadata: {
            ownership: {
              stewards: ['@platform-stewards'],
              productOwner: '@platform-product',
              technicalOwner: '@platform-tech',
              businessOwner: '@platform-business',
              metadata: {
                evidence: 'project-json',
              },
            },
          },
        },
      ],
      dependencies: [],
      codeownersByProject: {},
    };

    const result = toGovernanceWorkspaceAdapterResult(snapshot);

    expect(result.nodes).toEqual([
      expect.objectContaining({
        id: 'platform-domain',
        ownership: {
          stewards: ['@platform-stewards'],
          productOwner: '@platform-product',
          technicalOwner: '@platform-tech',
          businessOwner: '@platform-business',
          source: 'project-metadata',
          metadata: {
            evidence: 'project-json',
          },
        },
      }),
    ]);
  });

  it('does not treat loose owner metadata as canonical ownership', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'orders-domain',
          root: 'libs/orders/domain',
          type: 'library',
          tags: ['scope:orders', 'layer:domain'],
          targets: [],
          metadata: {
            owner: '@orders',
          },
        },
      ],
      dependencies: [],
      codeownersByProject: {},
    };

    const result = toGovernanceWorkspaceAdapterResult(snapshot);

    expect(result.nodes).toEqual([
      expect.objectContaining({
        id: 'orders-domain',
        metadata: {
          nx: expect.objectContaining({
            projectMetadata: {
              owner: '@orders',
            },
          }),
        },
      }),
    ]);
    expect(result.nodes?.[0]).not.toHaveProperty('ownership');
  });

  it('normalizes classification tag values while preserving raw tags', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'booking',
          root: 'libs/booking',
          type: 'library',
          tags: [' domain: booking ', ' layer: domain ', 'scope: booking '],
          targets: [],
          metadata: {},
        },
        {
          name: 'shared',
          root: 'libs/shared',
          type: 'library',
          tags: ['domain: shared', 'layer:data-access '],
          targets: [],
          metadata: {},
        },
      ],
      dependencies: [
        {
          source: 'booking',
          target: 'shared',
          type: 'static',
        },
      ],
      codeownersByProject: {},
    };

    const result = toGovernanceWorkspaceAdapterResult(snapshot);

    expect(result.nodes?.[0]).toEqual(
      expect.objectContaining({
        id: 'booking',
        tags: [' domain: booking ', ' layer: domain ', 'scope: booking '],
        classification: {
          domain: 'booking',
          layer: 'domain',
          scope: 'booking',
          tags: [' domain: booking ', ' layer: domain ', 'scope: booking '],
        },
      })
    );
    expect(result.nodes?.[1]).toEqual(
      expect.objectContaining({
        id: 'shared',
        tags: ['domain: shared', 'layer:data-access '],
        classification: {
          domain: 'shared',
          layer: 'data-access',
          tags: ['domain: shared', 'layer:data-access '],
        },
      })
    );
    expect(result.relations).toEqual([
      expect.objectContaining({
        sourceNodeId: 'booking',
        targetNodeId: 'shared',
        kind: 'dependency',
      }),
    ]);
  });

  it('treats empty canonical classification tag values as missing metadata', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'empty-tags',
          root: 'libs/empty-tags',
          type: 'library',
          tags: ['domain: ', 'layer:    '],
          targets: [],
          metadata: {},
        },
      ],
      dependencies: [],
      codeownersByProject: {},
    };

    const result = toGovernanceWorkspaceAdapterResult(snapshot);

    expect(result.nodes?.[0]).toEqual(
      expect.objectContaining({
        id: 'empty-tags',
        tags: ['domain: ', 'layer:    '],
        classification: {
          tags: ['domain: ', 'layer:    '],
        },
      })
    );
  });

  it('builds deterministic node and relation ids from nx identities', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'app',
          root: 'apps/app',
          type: 'application',
          tags: [],
          targets: [],
          metadata: {},
        },
      ],
      dependencies: [
        {
          source: 'app',
          target: 'shared',
          type: 'static',
          sourceFile: 'apps/app/src/main.ts',
        },
      ],
      codeownersByProject: {},
    };

    expect(buildNxGovernanceNodeId(snapshot.projects[0])).toBe('app');
    expect(buildNxGovernanceRelationId(snapshot.dependencies[0])).toBe(
      'nx:app->shared:static:apps/app/src/main.ts'
    );
  });
});

import type { GovernanceWorkspaceAdapterResult } from '@anarchitects/governance-core';

import type { AdapterWorkspaceSnapshot } from './types.js';
import { toGovernanceWorkspaceAdapterResult } from './to-governance-workspace-adapter-result.js';

describe('toGovernanceWorkspaceAdapterResult', () => {
  it('maps nx snapshot data into the core-owned adapter result shape', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'booking-ui',
          root: 'libs/booking/ui',
          type: 'library',
          tags: ['scope:booking', 'layer:ui', 'type:ui'],
          targets: ['test', 'build'],
          metadata: {
            documentation: true,
          },
        },
        {
          name: 'booking-domain',
          root: 'libs/booking/domain',
          type: 'library',
          tags: ['scope:booking', 'layer:domain', 'type:domain'],
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
      projects: [
        {
          id: 'booking-ui',
          name: 'booking-ui',
          root: 'libs/booking/ui',
          type: 'library',
          tags: ['scope:booking', 'layer:ui', 'type:ui'],
          metadata: {
            documentation: true,
          },
        },
        {
          id: 'booking-domain',
          name: 'booking-domain',
          root: 'libs/booking/domain',
          type: 'library',
          tags: ['scope:booking', 'layer:domain', 'type:domain'],
          metadata: {
            ownership: {
              team: 'booking-team',
            },
          },
          ownership: {
            contacts: ['@booking-team'],
            source: 'codeowners',
          },
        },
      ],
      dependencies: [
        {
          sourceProjectId: 'booking-ui',
          targetProjectId: 'booking-domain',
          type: 'static',
          sourceFile: 'libs/booking/ui/src/lib/ui.ts',
          metadata: {
            externalNodes: false,
          },
        },
      ],
      nodes: [
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
            documentation: true,
            nx: {
              projectType: 'library',
              targets: ['test', 'build'],
            },
          },
        },
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
            ownership: {
              team: 'booking-team',
            },
            nx: {
              projectType: 'library',
              targets: ['lint'],
            },
          },
          ownership: {
            contacts: ['@booking-team'],
            source: 'codeowners',
          },
        },
      ],
      relations: [
        {
          id: 'nx:booking-ui->booking-domain:static:0',
          sourceNodeId: 'booking-ui',
          targetNodeId: 'booking-domain',
          kind: 'dependency',
          metadata: {
            externalNodes: false,
            dependencyType: 'static',
            sourceFile: 'libs/booking/ui/src/lib/ui.ts',
          },
        },
      ],
      capabilities: [
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
      ],
    });
  });
});

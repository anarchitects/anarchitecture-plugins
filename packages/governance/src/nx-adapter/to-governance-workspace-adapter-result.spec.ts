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
          metadata: {
            documentation: true,
          },
        },
        {
          name: 'booking-domain',
          root: 'libs/booking/domain',
          type: 'library',
          tags: ['scope:booking', 'layer:domain', 'type:domain'],
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
        },
      ],
      codeownersByProject: {
        'booking-domain': ['@booking-team'],
      },
    };

    expect(toGovernanceWorkspaceAdapterResult(snapshot)).toEqual({
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
        },
      ],
      capabilities: [
        {
          id: 'capability:nx',
          data: {
            projectGraphAvailable: true,
            tagsAvailable: true,
            metadataAvailable: true,
            source: 'nx-project-graph',
          },
        },
      ],
    });
  });
});

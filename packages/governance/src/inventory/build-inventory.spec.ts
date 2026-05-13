import type { GovernanceWorkspaceAdapterResult } from '../core/index.js';
import { coreTestAdapterResult } from '../core/testing/workspace.fixtures.js';

import { buildInventory } from './build-inventory.js';

describe('buildInventory', () => {
  it('builds inventory from a core-owned adapter result', () => {
    const inventory = buildInventory(coreTestAdapterResult, {
      projectOverrides: {},
    });

    expect(inventory).toMatchObject({
      id: 'workspace',
      name: 'workspace',
      root: '/virtual/workspace',
    });
    expect(inventory.projects.map((project) => project.id)).toEqual([
      'booking-ui',
      'booking-domain',
      'platform-shell',
    ]);
    expect(inventory.dependencies).toEqual([
      {
        source: 'booking-ui',
        target: 'booking-domain',
        type: 'static',
      },
      {
        source: 'platform-shell',
        target: 'booking-ui',
        type: 'static',
        sourceFile: 'apps/platform-shell/src/main.ts',
      },
    ]);
  });

  it('preserves tag-derived domain and layer mapping', () => {
    const inventory = buildInventory(coreTestAdapterResult, {
      projectOverrides: {},
    });

    expect(inventory.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'booking-ui',
          tags: ['scope:booking', 'layer:ui', 'type:ui'],
          domain: 'booking',
          layer: 'ui',
        }),
        expect.objectContaining({
          id: 'booking-domain',
          tags: ['scope:booking', 'layer:domain', 'type:domain'],
          domain: 'booking',
          layer: 'domain',
        }),
      ])
    );
  });

  it('preserves ownership merge behavior and project overrides', () => {
    const adapterResult: GovernanceWorkspaceAdapterResult = {
      workspaceRoot: '/virtual/workspace',
      projects: [
        {
          id: 'inventory-app',
          root: 'apps/inventory-app',
          type: 'application',
          tags: ['scope:inventory', 'layer:app'],
          metadata: {
            ownership: {
              team: 'inventory-team',
            },
          },
          ownership: {
            contacts: ['@inventory-owners'],
            source: 'codeowners',
          },
        },
        {
          id: 'inventory-docs',
          root: 'libs/inventory/docs',
          type: 'library',
          tags: ['scope:inventory', 'layer:docs'],
          metadata: {},
        },
      ],
      dependencies: [
        {
          sourceProjectId: 'inventory-app',
          targetProjectId: 'inventory-docs',
          type: 'dynamic',
        },
      ],
    };

    const inventory = buildInventory(adapterResult, {
      projectOverrides: {
        'inventory-docs': {
          domain: 'inventory',
          layer: 'documentation',
          ownershipTeam: 'docs-team',
          documentation: false,
        },
      },
    });

    expect(inventory.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'inventory-app',
          ownership: {
            team: 'inventory-team',
            contacts: ['@inventory-owners'],
            source: 'merged',
          },
        }),
        expect.objectContaining({
          id: 'inventory-docs',
          domain: 'inventory',
          layer: 'documentation',
          ownership: {
            team: 'docs-team',
            contacts: [],
            source: 'project-metadata',
          },
          metadata: {
            documentation: false,
          },
        }),
      ])
    );
    expect(inventory.dependencies).toEqual([
      {
        source: 'inventory-app',
        target: 'inventory-docs',
        type: 'dynamic',
      },
    ]);
  });
});

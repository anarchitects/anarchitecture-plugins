import type { AdapterWorkspaceSnapshot } from './types.js';
import {
  NX_CANONICAL_CAPABILITY_IDS,
  createNxCapabilities,
  createNxCapability,
} from './capability.js';

describe('createNxCapability', () => {
  it('creates a capability with the capability:nx id', () => {
    expect(
      createNxCapability({
        workspaceRoot: '/workspace',
        snapshot: {
          root: '/workspace',
          projects: [],
          dependencies: [],
          codeownersByProject: {},
        },
      }).id
    ).toBe('capability:nx');
  });

  it('includes the workspace root', () => {
    expect(
      createNxCapability({
        workspaceRoot: '/workspace',
        snapshot: {
          root: '/workspace',
          projects: [],
          dependencies: [],
          codeownersByProject: {},
        },
      }).data
    ).toEqual({
      workspaceRoot: '/workspace',
      projects: [],
    });
  });

  it('maps projects to name, root, type, tags, and target names only', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'booking-ui',
          root: 'libs/booking/ui',
          type: 'library',
          tags: ['scope:booking', 'layer:ui'],
          targets: ['test', 'build'],
          metadata: {
            documentation: true,
            ownership: {
              team: 'booking-team',
            },
          },
        },
      ],
      dependencies: [],
      codeownersByProject: {},
    };

    expect(
      createNxCapability({
        workspaceRoot: '/workspace',
        snapshot,
      })
    ).toEqual({
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
    });
  });

  it('sorts projects deterministically by project name', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'z-project',
          root: 'libs/z',
          type: 'library',
          tags: ['scope:z'],
          targets: [],
          metadata: {},
        },
        {
          name: 'a-project',
          root: 'libs/a',
          type: 'application',
          tags: ['scope:a'],
          targets: [],
          metadata: {},
        },
      ],
      dependencies: [],
      codeownersByProject: {},
    };

    expect(
      createNxCapability({
        workspaceRoot: '/workspace',
        snapshot,
      }).data?.projects.map((project) => project.name)
    ).toEqual(['a-project', 'z-project']);
  });

  it('normalizes missing tags and targets to empty arrays', () => {
    const snapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'booking-ui',
          root: 'libs/booking/ui',
          type: 'library',
          metadata: {},
        },
      ],
      dependencies: [],
      codeownersByProject: {},
    } as AdapterWorkspaceSnapshot;

    expect(
      createNxCapability({
        workspaceRoot: '/workspace',
        snapshot,
      }).data?.projects
    ).toEqual([
      {
        name: 'booking-ui',
        root: 'libs/booking/ui',
        type: 'library',
        tags: [],
        targets: [],
      },
    ]);
  });

  it('does not expose the raw snapshot object shape', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'booking-ui',
          root: 'libs/booking/ui',
          type: 'library',
          tags: ['scope:booking'],
          targets: ['build'],
          metadata: {
            documentation: true,
          },
        },
      ],
      dependencies: [
        {
          source: 'booking-ui',
          target: 'booking-domain',
          type: 'static',
        },
      ],
      codeownersByProject: {
        'booking-ui': ['@booking-team'],
      },
    };

    expect(
      createNxCapability({
        workspaceRoot: '/workspace',
        snapshot,
      }).data?.projects[0]
    ).toEqual({
      name: 'booking-ui',
      root: 'libs/booking/ui',
      type: 'library',
      tags: ['scope:booking'],
      targets: ['build'],
    });
  });

  it('emits stable namespaced canonical capability ids with the legacy capability preserved', () => {
    const capabilities = createNxCapabilities({
      workspaceRoot: '/workspace',
      snapshot: {
        root: '/workspace',
        projects: [],
        dependencies: [],
        codeownersByProject: {},
      },
    });

    expect(capabilities.map((capability) => capability.id)).toEqual([
      'capability:nx',
      'nx.dependency-graph',
      'nx.inferred-targets',
      'nx.project-graph',
    ]);
    expect(
      NX_CANONICAL_CAPABILITY_IDS.every((id) => id.startsWith('nx.'))
    ).toBe(true);
  });

  it('describes project graph and dependency graph facts', () => {
    const capabilities = createNxCapabilities({
      workspaceRoot: '/workspace',
      snapshot: {
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
          {
            name: 'shared',
            root: 'libs/shared',
            type: 'library',
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
            metadata: {
              externalNodes: false,
            },
          },
        ],
        codeownersByProject: {},
      },
    });

    expect(capabilityData(capabilities, 'nx.project-graph')).toEqual({
      workspaceRoot: '/workspace',
      projectCount: 2,
      projects: [
        {
          id: 'app',
          name: 'app',
          root: 'apps/app',
          type: 'application',
        },
        {
          id: 'shared',
          name: 'shared',
          root: 'libs/shared',
          type: 'library',
        },
      ],
    });
    expect(capabilityData(capabilities, 'nx.dependency-graph')).toEqual({
      dependencyCount: 1,
      dependencies: [
        {
          sourceProjectId: 'app',
          targetProjectId: 'shared',
          type: 'static',
          sourceFile: 'apps/app/src/main.ts',
        },
      ],
    });
  });

  it('emits project metadata, tags, targets, profiles, and ownership evidence when available', () => {
    const capabilities = createNxCapabilities({
      workspaceRoot: '/workspace',
      snapshot: {
        root: '/workspace',
        projects: [
          {
            name: 'booking-ui',
            root: 'libs/booking/ui',
            type: 'library',
            tags: ['scope:booking', 'layer:ui'],
            targets: ['test', 'build'],
            metadata: {
              documentation: true,
              ownership: {
                team: '@booking',
              },
            },
          },
        ],
        dependencies: [],
        codeownersByProject: {
          'booking-ui': ['@booking-team'],
        },
        governanceProfileFiles: [
          'tools/governance/profiles/frontend-layered.json',
        ],
      },
    });

    expect(capabilityData(capabilities, 'nx.project-metadata')).toEqual({
      projectCount: 1,
      projects: [
        {
          id: 'booking-ui',
          metadataKeys: ['documentation', 'ownership'],
        },
      ],
    });
    expect(capabilityData(capabilities, 'nx.project-tags')).toEqual({
      projectCount: 1,
      projects: [
        {
          id: 'booking-ui',
          tags: ['scope:booking', 'layer:ui'],
        },
      ],
    });
    expect(capabilityData(capabilities, 'nx.targets')).toEqual({
      projectCount: 1,
      targetCount: 2,
      projects: [
        {
          id: 'booking-ui',
          targets: ['build', 'test'],
        },
      ],
    });
    expect(capabilityData(capabilities, 'nx.governance-profiles')).toEqual({
      profileCount: 1,
      profiles: ['tools/governance/profiles/frontend-layered.json'],
    });
    expect(capabilityData(capabilities, 'capability:ownership')).toEqual({
      source: 'codeowners',
      sources: ['codeowners', 'project-metadata'],
    });
    expect(capabilityData(capabilities, 'nx.ownership-evidence')).toEqual({
      projectCount: 1,
      projects: [
        {
          id: 'booking-ui',
          contacts: ['@booking-team'],
          source: 'codeowners',
        },
      ],
    });
  });

  it('handles optional missing facts without dropping baseline capabilities', () => {
    const capabilities = createNxCapabilities({
      workspaceRoot: '/workspace',
      snapshot: {
        root: '/workspace',
        projects: [
          {
            name: 'app',
            root: 'apps/app',
            type: 'application',
            metadata: {},
          },
        ],
        dependencies: [],
        codeownersByProject: {},
      } as AdapterWorkspaceSnapshot,
    });

    expect(
      capabilities.some((capability) => capability.id === 'nx.targets')
    ).toBe(false);
    expect(
      capabilities.some((capability) => capability.id === 'nx.project-tags')
    ).toBe(false);
    expect(
      capabilities.some(
        (capability) => capability.id === 'capability:ownership'
      )
    ).toBe(false);
    expect(capabilityData(capabilities, 'nx.inferred-targets')).toEqual({
      available: false,
      profileGlob: 'tools/governance/profiles/*.json',
      profileCount: 0,
    });
    expect(capabilities.map((capability) => capability.id)).toContain(
      'nx.project-graph'
    );
    expect(capabilities.map((capability) => capability.id)).toContain(
      'nx.dependency-graph'
    );
  });
});

function capabilityData(
  capabilities: ReturnType<typeof createNxCapabilities>,
  id: string
): unknown {
  return capabilities.find((capability) => capability.id === id)?.data;
}

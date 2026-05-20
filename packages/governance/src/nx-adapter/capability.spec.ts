import type { AdapterWorkspaceSnapshot } from './types.js';
import { createNxCapability } from './capability.js';

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
});

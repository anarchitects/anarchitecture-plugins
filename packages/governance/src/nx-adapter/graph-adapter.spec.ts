import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import * as nxDevkit from '@nx/devkit';

import {
  GraphAdapter,
  WorkspaceGraphSnapshot,
  summarizeWorkspaceGraph,
} from './graph-adapter.js';

describe('GraphAdapter', () => {
  const adapter = new GraphAdapter();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads and normalizes graph via Nx API', async () => {
    const snapshot = await adapter.readSnapshot();

    expect(snapshot.source).toBe('nx-graph');
    expect(typeof snapshot.extractedAt).toBe('string');
    expect(new Date(snapshot.extractedAt).toISOString()).toBe(
      snapshot.extractedAt
    );
    expect(Array.isArray(snapshot.projects)).toBe(true);
    expect(Array.isArray(snapshot.dependencies)).toBe(true);
    expect(snapshot.projects.length).toBeGreaterThan(0);
  });

  it('falls back to JSON input when Nx API is unavailable', async () => {
    const fixture = makeGraphFixtureFile({
      nodes: {
        app: {
          name: 'app',
          data: { root: 'apps/app', projectType: 'application', tags: [] },
        },
        lib: {
          name: 'lib',
          data: { root: 'libs/lib', projectType: 'library', tags: [] },
        },
      },
      dependencies: {
        app: [{ target: 'lib', type: 'static' }],
        lib: [],
      },
    });

    try {
      jest
        .spyOn(nxDevkit, 'createProjectGraphAsync')
        .mockRejectedValue(new Error('api unavailable'));

      const snapshot = await adapter.readSnapshot({
        graphJson: fixture.filePath,
      });

      expect(snapshot.source).toBe('nx-graph');
      expect(snapshot.projects.map((project) => project.id)).toEqual([
        'app',
        'lib',
      ]);
      expect(snapshot.dependencies).toEqual([
        {
          sourceProjectId: 'app',
          targetProjectId: 'lib',
          type: 'static',
        },
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  it('supports graph envelope JSON shape', () => {
    const fixture = makeGraphFixtureFile({
      graph: {
        nodes: {
          shared: {
            name: 'shared',
            data: {
              root: 'libs/shared',
              projectType: 'library',
              tags: ['domain:shared', 'layer:data-access'],
            },
          },
        },
        dependencies: {
          shared: [],
        },
      },
    });

    try {
      const snapshot = adapter.readSnapshotFromJson(fixture.filePath);

      expect(snapshot.projects).toEqual([
        {
          id: 'shared',
          name: 'shared',
          root: 'libs/shared',
          type: 'library',
          tags: ['domain:shared', 'layer:data-access'],
          domain: 'shared',
          layer: 'data-access',
        },
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  it('prefers domain tags over scope tags when both are present', () => {
    const fixture = makeGraphFixtureFile({
      nodes: {
        app: {
          data: {
            root: 'apps/app',
            projectType: 'app',
            tags: ['domain:checkout', 'scope:payments', 'layer:feature'],
          },
        },
      },
      dependencies: {
        app: [],
      },
    });

    try {
      const snapshot = adapter.readSnapshotFromJson(fixture.filePath);

      expect(snapshot.projects).toEqual([
        {
          id: 'app',
          name: 'app',
          root: 'apps/app',
          type: 'application',
          tags: ['domain:checkout', 'scope:payments', 'layer:feature'],
          domain: 'checkout',
          layer: 'feature',
        },
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  it('uses scope tags as fallback only when workspace scope tags are present', () => {
    const fixture = makeGraphFixtureFile({
      nodes: {
        payments: {
          data: {
            root: 'libs/payments',
            projectType: 'library',
            tags: ['scope:payments'],
          },
        },
        shared: {
          data: {
            root: 'libs/shared',
            projectType: 'lib',
            tags: ['scope:shared'],
          },
        },
      },
      dependencies: {
        payments: [{ target: 'shared', type: 'dynamic' }],
        shared: [],
      },
    });

    try {
      const snapshot = adapter.readSnapshotFromJson(fixture.filePath);

      expect(snapshot.projects).toEqual([
        {
          id: 'payments',
          name: 'payments',
          root: 'libs/payments',
          type: 'library',
          tags: ['scope:payments'],
          domain: 'payments',
          layer: undefined,
        },
        {
          id: 'shared',
          name: 'shared',
          root: 'libs/shared',
          type: 'library',
          tags: ['scope:shared'],
          domain: 'shared',
          layer: undefined,
        },
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  it('does not infer domain from scope when scope conventions are absent', () => {
    const fixture = makeGraphFixtureFile({
      nodes: {
        app: {
          data: {
            root: 'apps/app',
            projectType: 'application',
            tags: ['type:app', 'layer:feature'],
          },
        },
      },
      dependencies: {
        app: [],
      },
    });

    try {
      const snapshot = adapter.readSnapshotFromJson(fixture.filePath);

      expect(snapshot.projects).toEqual([
        {
          id: 'app',
          name: 'app',
          root: 'apps/app',
          type: 'application',
          tags: ['type:app', 'layer:feature'],
          domain: undefined,
          layer: 'feature',
        },
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  it('skips malformed and unknown-target dependencies and keeps ordering deterministic', () => {
    const fixture = makeGraphFixtureFile({
      nodes: {
        z: {
          data: {
            root: 'libs/z',
            projectType: 'tool',
            tags: ['domain:platform', 'layer:util'],
          },
        },
        a: {
          data: {
            root: 'apps/a',
            projectType: 'app',
            tags: ['domain:a', 'layer:feature'],
          },
        },
        b: {
          data: {
            root: 'libs/b',
            projectType: 'library',
            tags: ['domain:b', 'layer:data-access'],
          },
        },
      },
      dependencies: {
        missing: [{ target: 'a', type: 'static' }],
        b: [
          { target: 'z', type: 'dynamic' },
          { target: 'does-not-exist', type: 'static' },
          { noTarget: 'a' },
        ],
        a: [{ target: 'b', type: 'static' }, 'invalid-shape'],
        z: [{ target: 'a', type: 'mystery' }],
      },
    });

    try {
      const snapshot = adapter.readSnapshotFromJson(fixture.filePath);

      expect(snapshot.projects.map((project) => project.id)).toEqual([
        'a',
        'b',
        'z',
      ]);
      expect(snapshot.projects.map((project) => project.type)).toEqual([
        'application',
        'library',
        'unknown',
      ]);
      expect(snapshot.dependencies).toEqual([
        {
          sourceProjectId: 'a',
          targetProjectId: 'b',
          type: 'static',
        },
        {
          sourceProjectId: 'b',
          targetProjectId: 'z',
          type: 'dynamic',
        },
        {
          sourceProjectId: 'z',
          targetProjectId: 'a',
          type: 'unknown',
        },
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  it('throws when no graph source is available', async () => {
    jest
      .spyOn(nxDevkit, 'createProjectGraphAsync')
      .mockRejectedValue(new Error('api unavailable'));

    await expect(adapter.readSnapshot()).rejects.toThrow(
      'Unable to load workspace graph from Nx API and no graphJson fallback was provided.'
    );
  });

  it('summarizes a normalized snapshot deterministically', () => {
    const snapshot: WorkspaceGraphSnapshot = {
      source: 'nx-graph',
      extractedAt: '2026-03-17T00:00:00.000Z',
      projects: [
        {
          id: 'a',
          name: 'a',
          type: 'library',
          tags: [],
        },
        {
          id: 'b',
          name: 'b',
          type: 'library',
          tags: [],
        },
      ],
      dependencies: [
        { sourceProjectId: 'a', targetProjectId: 'b', type: 'static' },
        { sourceProjectId: 'b', targetProjectId: 'a', type: 'static' },
      ],
    };

    expect(summarizeWorkspaceGraph(snapshot)).toEqual({
      projectCount: 2,
      dependencyCount: 2,
    });
  });
});

function makeGraphFixtureFile(content: Record<string, unknown>): {
  filePath: string;
  cleanup: () => void;
} {
  const dirPath = mkdtempSync(path.join(tmpdir(), 'nx-governance-graph-'));
  const filePath = path.join(dirPath, 'project-graph.json');
  writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');

  return {
    filePath,
    cleanup: () => rmSync(dirPath, { recursive: true, force: true }),
  };
}

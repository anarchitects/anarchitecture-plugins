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

    expect(snapshot.source.kind).toBe('nx-api');
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

      expect(snapshot.source).toEqual({
        kind: 'json',
        graphJsonPath: fixture.filePath,
      });
      expect(snapshot.projects.map((project) => project.name)).toEqual([
        'app',
        'lib',
      ]);
      expect(snapshot.dependencies).toHaveLength(1);
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
              tags: ['domain:shared'],
              metadata: { source: 'fixture' },
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
          name: 'shared',
          root: 'libs/shared',
          type: 'library',
          tags: ['domain:shared'],
          metadata: { source: 'fixture' },
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
      root: '/repo',
      source: { kind: 'json', graphJsonPath: '/repo/graph.json' },
      projects: [
        { name: 'a', root: 'a', type: 'library', tags: [], metadata: {} },
        { name: 'b', root: 'b', type: 'library', tags: [], metadata: {} },
      ],
      dependencies: [
        { source: 'a', target: 'b', type: 'static' },
        { source: 'b', target: 'a', type: 'static' },
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

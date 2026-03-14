import { promises as fs } from 'node:fs';
import path from 'node:path';

import { workspaceRoot } from '@nx/devkit';

import { GovernanceAssessment } from '../core/index.js';
import {
  formatTimestampForFilename,
  listMetricSnapshots,
  saveMetricSnapshot,
} from './index.js';

describe('snapshot-store', () => {
  const snapshotDir = `.governance-metrics/test-snapshots-${Date.now()}`;

  afterAll(async () => {
    await fs.rm(path.join(workspaceRoot, snapshotDir), {
      recursive: true,
      force: true,
    });
  });

  it('formats timestamps for file names', () => {
    const value = formatTimestampForFilename(
      new Date('2026-03-13T10:15:00.123Z')
    );
    expect(value).toBe('2026-03-13T10-15-00');
  });

  it('persists snapshots and lists them from disk', async () => {
    const assessment: GovernanceAssessment = {
      workspace: {
        id: 'workspace',
        name: 'workspace',
        root: workspaceRoot,
        projects: [],
        dependencies: [],
      },
      profile: 'angular-cleanup',
      warnings: [],
      violations: [],
      measurements: [
        {
          id: 'architectural-entropy',
          name: 'Architectural Entropy',
          value: 0.2,
          score: 80,
          maxScore: 100,
          unit: 'ratio',
        },
      ],
      health: {
        score: 80,
        grade: 'B',
        hotspots: [],
      },
      recommendations: [],
    };

    const result = await saveMetricSnapshot({
      assessment,
      snapshotDir,
      now: new Date('2026-03-13T10:15:00.000Z'),
      repo: 'test-repo',
      branch: 'main',
      commitSha: 'abc123',
    });

    expect(result.relativePath.endsWith('2026-03-13T10-15-00.json')).toBe(true);
    expect(result.snapshot.scores.workspaceHealth).toBe(80);

    const snapshots = await listMetricSnapshots(snapshotDir);
    expect(snapshots.length).toBeGreaterThan(0);
  });
});

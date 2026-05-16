import { promises as fs } from 'node:fs';
import path from 'node:path';

import { workspaceRoot } from '@nx/devkit';

import { GovernanceAssessment } from '../core/index.js';
import {
  formatTimestampForFilename,
  listMetricSnapshots,
  readMetricSnapshot,
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
      profile: 'frontend-layered',
      warnings: [],
      exceptions: {
        summary: {
          declaredCount: 0,
          matchedCount: 0,
          suppressedPolicyViolationCount: 0,
          suppressedConformanceFindingCount: 0,
          unusedExceptionCount: 0,
        },
        used: [],
        unused: [],
        suppressedFindings: [],
      },
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
      signalBreakdown: {
        total: 0,
        bySource: [
          { source: 'graph', count: 0 },
          { source: 'conformance', count: 0 },
          { source: 'policy', count: 0 },
        ],
        byType: [],
        bySeverity: [
          { severity: 'info', count: 0 },
          { severity: 'warning', count: 0 },
          { severity: 'error', count: 0 },
        ],
      },
      metricBreakdown: {
        families: [],
      },
      topIssues: [
        {
          type: 'ownership-gap',
          source: 'policy',
          severity: 'warning',
          count: 2,
          projects: ['libs/orders/data-access'],
          message: 'Ownership metadata is missing.',
        },
      ],
      health: {
        score: 80,
        status: 'warning',
        grade: 'B',
        hotspots: [],
        metricHotspots: [],
        projectHotspots: [],
        explainability: {
          summary:
            'Overall health is Warning at 80/100. Weakest metrics: Architectural Entropy (80). Dominant issues: none.',
          statusReason:
            'Score 80 is below the Good threshold (85) but meets the Warning threshold (70).',
          weakestMetrics: [
            {
              id: 'architectural-entropy',
              name: 'Architectural Entropy',
              score: 80,
            },
          ],
          dominantIssues: [],
        },
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
    expect(result.snapshot.metricSchemaVersion).toBe('1.2');
    expect(result.snapshot.health).toEqual({
      score: 80,
      status: 'warning',
      grade: 'B',
    });
    expect(result.snapshot.signalBreakdown).toEqual(assessment.signalBreakdown);
    expect(result.snapshot.metricBreakdown).toEqual(assessment.metricBreakdown);
    expect(result.snapshot.topIssues).toEqual(assessment.topIssues);

    const snapshots = await listMetricSnapshots(snapshotDir);
    expect(snapshots.length).toBeGreaterThan(0);
  });

  it('reads older snapshots that do not include enriched summary fields', async () => {
    const legacyPath = path.join(
      workspaceRoot,
      snapshotDir,
      '2026-03-01T10-00-00.json'
    );

    await fs.mkdir(path.dirname(legacyPath), { recursive: true });
    await fs.writeFile(
      legacyPath,
      `${JSON.stringify(
        {
          timestamp: '2026-03-01T10:00:00Z',
          repo: 'test-repo',
          branch: 'main',
          commitSha: 'abc123',
          pluginVersion: '0.1.0',
          metricSchemaVersion: '1.0',
          metrics: {
            'architectural-entropy': 0.2,
          },
          scores: {
            workspaceHealth: 80,
          },
          violations: [],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const snapshot = await readMetricSnapshot(legacyPath);
    expect(snapshot.metricSchemaVersion).toBe('1.0');
    expect(snapshot.health).toBeUndefined();
    expect(snapshot.signalBreakdown).toBeUndefined();
    expect(snapshot.metricBreakdown).toBeUndefined();
    expect(snapshot.topIssues).toBeUndefined();
    expect(snapshot.deliveryImpact).toBeUndefined();
  });
});

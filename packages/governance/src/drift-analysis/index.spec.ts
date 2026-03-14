import { MetricSnapshot } from '../core/index.js';

import { compareSnapshots, summarizeDrift } from './index.js';

describe('drift-analysis', () => {
  const baseline: MetricSnapshot = {
    timestamp: '2026-03-01T10:00:00Z',
    repo: 'repo',
    branch: 'main',
    commitSha: 'abc',
    pluginVersion: '0.1.0',
    metricSchemaVersion: '1.0',
    metrics: {
      'architectural-entropy': 0.2,
    },
    scores: {
      workspaceHealth: 70,
    },
    violations: [
      {
        type: 'domain-boundary',
        source: 'libs/a',
        target: 'libs/b',
      },
    ],
  };

  it('compares snapshots and tracks violation delta', () => {
    const current: MetricSnapshot = {
      ...baseline,
      timestamp: '2026-03-13T10:00:00Z',
      metrics: {
        'architectural-entropy': 0.15,
      },
      scores: {
        workspaceHealth: 76,
      },
      violations: [],
    };

    const comparison = compareSnapshots(baseline, current);

    expect(comparison.metricDeltas).toEqual([
      {
        id: 'architectural-entropy',
        baseline: 0.2,
        current: 0.15,
        delta: -0.05,
      },
    ]);
    expect(comparison.resolvedViolations.length).toBe(1);
    expect(comparison.newViolations.length).toBe(0);
  });

  it('classifies score deltas into drift signals', () => {
    const current: MetricSnapshot = {
      ...baseline,
      scores: {
        workspaceHealth: 65,
      },
    };

    const comparison = compareSnapshots(baseline, current);
    const signals = summarizeDrift(comparison, 0.1);

    expect(signals[0]?.status).toBe('worsening');
  });
});

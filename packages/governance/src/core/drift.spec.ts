import {
  buildDriftSummary,
  compareSnapshots,
  summarizeDrift,
  type MetricSnapshot,
} from './index.js';

function makeSnapshot(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    timestamp: '2026-05-13T10:00:00.000Z',
    repo: 'test-repo',
    branch: 'main',
    commitSha: 'abc123',
    pluginVersion: '0.1.0',
    metricSchemaVersion: '1.1',
    metrics: {
      'architectural-entropy': 0.2,
    },
    scores: {
      workspaceHealth: 80,
      'architectural-entropy': 80,
    },
    violations: [],
    health: {
      score: 80,
      status: 'warning',
      grade: 'B',
    },
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
      families: [
        {
          family: 'architecture',
          score: 80,
          measurements: [],
        },
      ],
    },
    topIssues: [],
    ...overrides,
  };
}

describe('core drift comparison', () => {
  it('compares identical snapshots without meaningful drift or file IO', () => {
    const baseline = makeSnapshot();
    const comparison = compareSnapshots(baseline, makeSnapshot());
    const signals = summarizeDrift(comparison);
    const summary = buildDriftSummary(signals);

    expect(comparison.metricDeltas).toEqual([
      {
        id: 'architectural-entropy',
        baseline: 0.2,
        current: 0.2,
        delta: 0,
      },
    ]);
    expect(comparison.scoreDeltas).toEqual([
      {
        id: 'architectural-entropy',
        baseline: 80,
        current: 80,
        delta: 0,
      },
      {
        id: 'workspaceHealth',
        baseline: 80,
        current: 80,
        delta: 0,
      },
    ]);
    expect(comparison.newViolations).toEqual([]);
    expect(comparison.resolvedViolations).toEqual([]);
    expect(summary.overallTrend).toBe('stable');
    expect(signals.every((signal) => signal.status === 'stable')).toBe(true);
  });

  it('captures changed health score and measurement deltas with current semantics', () => {
    const baseline = makeSnapshot();
    const current = makeSnapshot({
      metrics: {
        'architectural-entropy': 0.15,
      },
      scores: {
        workspaceHealth: 76,
        'architectural-entropy': 84,
      },
      health: {
        score: 76,
        status: 'warning',
        grade: 'B',
      },
      metricBreakdown: {
        families: [
          {
            family: 'architecture',
            score: 84,
            measurements: [],
          },
        ],
      },
    });

    const comparison = compareSnapshots(baseline, current);

    expect(comparison.metricDeltas).toEqual([
      {
        id: 'architectural-entropy',
        baseline: 0.2,
        current: 0.15,
        delta: -0.05,
      },
    ]);
    expect(comparison.healthDelta).toEqual({
      baselineScore: 80,
      currentScore: 76,
      scoreDelta: -4,
      baselineStatus: 'warning',
      currentStatus: 'warning',
      baselineGrade: 'B',
      currentGrade: 'B',
    });
    expect(comparison.metricFamilyDeltas).toEqual([
      {
        family: 'architecture',
        baseline: 80,
        current: 84,
        delta: 4,
      },
    ]);
  });

  it('captures new and resolved violations with current semantics', () => {
    const baseline = makeSnapshot({
      violations: [
        {
          type: 'domain-boundary',
          source: 'booking-ui',
          target: 'platform-shell',
          ruleId: 'domain-boundary',
        },
      ],
    });
    const current = makeSnapshot({
      violations: [
        {
          type: 'ownership-presence',
          source: 'booking-domain',
          ruleId: 'ownership-presence',
        },
      ],
    });

    const comparison = compareSnapshots(baseline, current);

    expect(comparison.newViolations).toEqual([
      {
        type: 'ownership-presence',
        source: 'booking-domain',
        ruleId: 'ownership-presence',
      },
    ]);
    expect(comparison.resolvedViolations).toEqual([
      {
        type: 'domain-boundary',
        source: 'booking-ui',
        target: 'platform-shell',
        ruleId: 'domain-boundary',
      },
    ]);
  });
});

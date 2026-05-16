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

  it('compares matching delivery-impact indices when both snapshots include them', () => {
    const baseline = makeSnapshot({
      deliveryImpact: {
        indices: [
          {
            id: 'cost-of-change',
            score: 68,
            risk: 'medium',
          },
          {
            id: 'time-to-market-risk',
            score: 72,
            risk: 'high',
          },
        ],
        topDrivers: [],
      },
    });
    const current = makeSnapshot({
      deliveryImpact: {
        indices: [
          {
            id: 'cost-of-change',
            score: 61,
            risk: 'medium',
          },
          {
            id: 'time-to-market-risk',
            score: 64,
            risk: 'medium',
          },
        ],
        topDrivers: [],
      },
    });

    const comparison = compareSnapshots(baseline, current);

    expect(comparison.deliveryImpactIndexDeltas).toEqual([
      {
        id: 'cost-of-change',
        baselineScore: 68,
        currentScore: 61,
        scoreDelta: -7,
        baselineRisk: 'medium',
        currentRisk: 'medium',
      },
      {
        id: 'time-to-market-risk',
        baselineScore: 72,
        currentScore: 64,
        scoreDelta: -8,
        baselineRisk: 'high',
        currentRisk: 'medium',
      },
    ]);
  });

  it('ignores delivery-impact indices missing from one side and keeps older snapshots comparable', () => {
    const baseline = makeSnapshot({
      metricSchemaVersion: '1.0',
    });
    const current = makeSnapshot({
      deliveryImpact: {
        indices: [
          {
            id: 'time-to-market-risk',
            score: 64,
            risk: 'medium',
          },
        ],
        topDrivers: [],
      },
    });

    const comparison = compareSnapshots(baseline, current);

    expect(comparison.metricDeltas).toEqual([
      {
        id: 'architectural-entropy',
        baseline: 0.2,
        current: 0.2,
        delta: 0,
      },
    ]);
    expect(comparison.deliveryImpactIndexDeltas).toBeUndefined();
    expect(comparison.healthDelta).toEqual({
      baselineScore: 80,
      currentScore: 80,
      scoreDelta: 0,
      baselineStatus: 'warning',
      currentStatus: 'warning',
      baselineGrade: 'B',
      currentGrade: 'B',
    });
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

  it('keeps plain snapshot fixtures JSON-serializable without host storage helpers', () => {
    const snapshot = makeSnapshot({
      topIssues: [
        {
          type: 'domain-boundary-violation',
          source: 'policy',
          severity: 'error',
          count: 1,
          projects: ['booking-ui', 'platform-shell'],
          ruleId: 'domain-boundary',
          message: 'Cross-domain dependency.',
        },
      ],
      deliveryImpact: {
        indices: [
          {
            id: 'cost-of-change',
            score: 68,
            risk: 'medium',
          },
        ],
        topDrivers: [
          {
            id: 'change-impact-radius-pressure',
            label: 'Change impact radius pressure',
            score: 88,
            value: 12,
            unit: 'count',
            trend: 'worsening',
          },
        ],
      },
    });

    expect(JSON.parse(JSON.stringify(snapshot)) as MetricSnapshot).toEqual(
      snapshot
    );
  });
});

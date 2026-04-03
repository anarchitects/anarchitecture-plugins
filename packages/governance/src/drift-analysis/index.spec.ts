import { MetricSnapshot } from '../core/index.js';

import {
  buildDriftSummary,
  compareSnapshots,
  summarizeDrift,
} from './index.js';

describe('drift-analysis', () => {
  const baseline: MetricSnapshot = {
    timestamp: '2026-03-01T10:00:00Z',
    repo: 'repo',
    branch: 'main',
    commitSha: 'abc',
    pluginVersion: '0.1.0',
    metricSchemaVersion: '1.1',
    metrics: {
      'architectural-entropy': 0.2,
    },
    scores: {
      workspaceHealth: 70,
      'architectural-entropy': 80,
    },
    violations: [
      {
        type: 'domain-boundary',
        source: 'libs/a',
        target: 'libs/b',
      },
    ],
    health: {
      score: 70,
      status: 'warning',
      grade: 'C',
    },
    signalBreakdown: {
      total: 3,
      bySource: [
        { source: 'graph', count: 2 },
        { source: 'conformance', count: 0 },
        { source: 'policy', count: 1 },
      ],
      byType: [
        { type: 'structural-dependency', count: 2 },
        { type: 'domain-boundary-violation', count: 1 },
      ],
      bySeverity: [
        { severity: 'info', count: 1 },
        { severity: 'warning', count: 1 },
        { severity: 'error', count: 1 },
      ],
    },
    metricBreakdown: {
      families: [
        {
          family: 'architecture',
          score: 78,
          measurements: [],
        },
        {
          family: 'ownership',
          score: 82,
          measurements: [],
        },
      ],
    },
    topIssues: [
      {
        type: 'domain-boundary-violation',
        source: 'policy',
        severity: 'error',
        count: 2,
        projects: ['libs/a', 'libs/b'],
        ruleId: 'domain-boundary',
        message: 'Cross-domain dependency violates declared boundary.',
      },
      {
        type: 'structural-dependency',
        source: 'graph',
        severity: 'info',
        count: 3,
        projects: ['libs/a'],
        message: 'Structural dependency fanout is increasing.',
      },
    ],
  };

  it('compares enriched snapshots and tracks deterministic delta sections', () => {
    const current: MetricSnapshot = {
      ...baseline,
      timestamp: '2026-03-13T10:00:00Z',
      metrics: {
        'architectural-entropy': 0.15,
      },
      scores: {
        workspaceHealth: 76,
        'architectural-entropy': 84,
      },
      violations: [],
      health: {
        score: 76,
        status: 'warning',
        grade: 'B',
      },
      signalBreakdown: {
        total: 2,
        bySource: [
          { source: 'graph', count: 1 },
          { source: 'conformance', count: 0 },
          { source: 'policy', count: 1 },
        ],
        byType: [
          { type: 'structural-dependency', count: 1 },
          { type: 'domain-boundary-violation', count: 1 },
        ],
        bySeverity: [
          { severity: 'info', count: 1 },
          { severity: 'warning', count: 0 },
          { severity: 'error', count: 1 },
        ],
      },
      metricBreakdown: {
        families: [
          {
            family: 'architecture',
            score: 83,
            measurements: [],
          },
          {
            family: 'ownership',
            score: 82,
            measurements: [],
          },
        ],
      },
      topIssues: [
        {
          type: 'domain-boundary-violation',
          source: 'policy',
          severity: 'error',
          count: 1,
          projects: ['libs/a', 'libs/b'],
          ruleId: 'domain-boundary',
          message: 'Cross-domain dependency violates declared boundary.',
        },
        {
          type: 'structural-dependency',
          source: 'graph',
          severity: 'info',
          count: 1,
          projects: ['libs/a', 'libs/c'],
          message: 'Structural dependency fanout is increasing.',
        },
      ],
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
    expect(comparison.scoreDeltas).toEqual([
      {
        id: 'architectural-entropy',
        baseline: 80,
        current: 84,
        delta: 4,
      },
      {
        id: 'workspaceHealth',
        baseline: 70,
        current: 76,
        delta: 6,
      },
    ]);
    expect(comparison.healthDelta).toEqual({
      baselineScore: 70,
      currentScore: 76,
      scoreDelta: 6,
      baselineStatus: 'warning',
      currentStatus: 'warning',
      baselineGrade: 'C',
      currentGrade: 'B',
    });
    expect(comparison.signalDeltas?.bySource).toEqual([
      { source: 'graph', baseline: 2, current: 1, delta: -1 },
      { source: 'conformance', baseline: 0, current: 0, delta: 0 },
      { source: 'policy', baseline: 1, current: 1, delta: 0 },
    ]);
    expect(comparison.signalDeltas?.byType).toEqual([
      {
        type: 'structural-dependency',
        baseline: 2,
        current: 1,
        delta: -1,
      },
      {
        type: 'domain-boundary-violation',
        baseline: 1,
        current: 1,
        delta: 0,
      },
    ]);
    expect(comparison.signalDeltas?.bySeverity).toEqual([
      { severity: 'info', baseline: 1, current: 1, delta: 0 },
      { severity: 'warning', baseline: 1, current: 0, delta: -1 },
      { severity: 'error', baseline: 1, current: 1, delta: 0 },
    ]);
    expect(comparison.metricFamilyDeltas).toEqual([
      {
        family: 'architecture',
        baseline: 78,
        current: 83,
        delta: 5,
      },
      {
        family: 'ownership',
        baseline: 82,
        current: 82,
        delta: 0,
      },
    ]);
    expect(comparison.topIssueDeltas).toEqual([
      {
        type: 'domain-boundary-violation',
        source: 'policy',
        severity: 'error',
        ruleId: 'domain-boundary',
        message: 'Cross-domain dependency violates declared boundary.',
        baselineCount: 2,
        currentCount: 1,
        delta: -1,
        projects: ['libs/a', 'libs/b'],
      },
      {
        type: 'structural-dependency',
        source: 'graph',
        severity: 'info',
        message: 'Structural dependency fanout is increasing.',
        baselineCount: 3,
        currentCount: 1,
        delta: -2,
        projects: ['libs/a', 'libs/c'],
      },
    ]);
    expect(comparison.resolvedViolations.length).toBe(1);
    expect(comparison.newViolations.length).toBe(0);
  });

  it('omits enriched delta groups when comparing older snapshot schema versions', () => {
    const current: MetricSnapshot = {
      ...baseline,
      metricSchemaVersion: '1.0',
      health: undefined,
      signalBreakdown: undefined,
      metricBreakdown: undefined,
      topIssues: undefined,
    };

    const comparison = compareSnapshots(current, baseline);

    expect(comparison.healthDelta).toBeUndefined();
    expect(comparison.signalDeltas).toBeUndefined();
    expect(comparison.metricFamilyDeltas).toBeUndefined();
    expect(comparison.topIssueDeltas).toBeUndefined();
    expect(comparison.metricDeltas.length).toBeGreaterThan(0);
    expect(comparison.scoreDeltas.length).toBeGreaterThan(0);
  });

  it('classifies score-like and count-like drift signals and builds deterministic summaries', () => {
    const current: MetricSnapshot = {
      ...baseline,
      timestamp: '2026-03-13T10:00:00Z',
      scores: {
        workspaceHealth: 65,
        'architectural-entropy': 81,
      },
      health: {
        score: 65,
        status: 'critical',
        grade: 'D',
      },
      signalBreakdown: {
        total: 5,
        bySource: [
          { source: 'graph', count: 2 },
          { source: 'conformance', count: 1 },
          { source: 'policy', count: 2 },
        ],
        byType: [
          { type: 'structural-dependency', count: 2 },
          { type: 'conformance-violation', count: 1 },
          { type: 'domain-boundary-violation', count: 2 },
        ],
        bySeverity: [
          { severity: 'info', count: 1 },
          { severity: 'warning', count: 1 },
          { severity: 'error', count: 3 },
        ],
      },
      metricBreakdown: {
        families: [
          {
            family: 'architecture',
            score: 75,
            measurements: [],
          },
          {
            family: 'ownership',
            score: 80,
            measurements: [],
          },
        ],
      },
      topIssues: [
        {
          type: 'domain-boundary-violation',
          source: 'policy',
          severity: 'error',
          count: 4,
          projects: ['libs/a', 'libs/b', 'libs/c'],
          ruleId: 'domain-boundary',
          message: 'Cross-domain dependency violates declared boundary.',
        },
      ],
      violations: [
        ...baseline.violations,
        {
          type: 'domain-boundary',
          source: 'libs/c',
          target: 'libs/d',
        },
      ],
    };

    const comparison = compareSnapshots(baseline, current);
    const signals = summarizeDrift(comparison, 0.1);
    const summary = buildDriftSummary(signals);

    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workspaceHealth',
          kind: 'workspace-health',
          status: 'worsening',
          baseline: 70,
          current: 65,
          delta: -5,
        }),
        expect.objectContaining({
          id: 'metric-family:architecture',
          kind: 'metric-family',
          status: 'worsening',
          delta: -3,
        }),
        expect.objectContaining({
          id: 'signal-source:conformance',
          kind: 'signal-source',
          status: 'worsening',
          delta: 1,
        }),
        expect.objectContaining({
          id: 'top-issue:domain-boundary-violation|policy|error|domain-boundary|Cross-domain dependency violates declared boundary.',
          kind: 'top-issue',
          status: 'worsening',
          delta: 2,
        }),
        expect.objectContaining({
          id: 'violation-footprint',
          kind: 'violation-footprint',
          status: 'worsening',
          baseline: 1,
          current: 2,
          delta: 1,
        }),
      ])
    );
    expect(summary.overallTrend).toBe('worsening');
    expect(summary.worseningCount).toBeGreaterThan(0);
    expect(summary.topWorsening[0]?.magnitude).toBeGreaterThanOrEqual(
      summary.topWorsening[1]?.magnitude ?? 0
    );
    expect(summary.improvingCount).toBeGreaterThan(0);
    expect(summary.topImproving[0]?.magnitude).toBeGreaterThanOrEqual(
      summary.topImproving[1]?.magnitude ?? 0
    );
  });
});

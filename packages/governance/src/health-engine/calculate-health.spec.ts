import { GovernanceTopIssue, Measurement, Violation } from '../core/index.js';

import {
  buildRecommendations,
  calculateHealthScore,
} from './calculate-health.js';

describe('calculateHealthScore', () => {
  it('grades score buckets correctly', () => {
    const measurements: Measurement[] = [
      {
        id: 'm1',
        name: 'Metric 1',
        value: 0.9,
        score: 95,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'm2',
        name: 'Metric 2',
        value: 0.8,
        score: 85,
        maxScore: 100,
        unit: 'ratio',
      },
    ];

    const health = calculateHealthScore(measurements);

    expect(health.score).toBe(90);
    expect(health.status).toBe('good');
    expect(health.grade).toBe('A');
    expect(health.metricHotspots).toEqual([]);
    expect(health.projectHotspots).toEqual([]);
    expect(
      health.explainability.weakestMetrics.map((metric) => metric.id)
    ).toEqual(['m2', 'm1']);
  });

  it('marks low-scoring metrics as hotspots', () => {
    const topIssues: GovernanceTopIssue[] = [
      {
        type: 'domain-boundary-violation',
        source: 'policy',
        severity: 'error',
        count: 2,
        projects: ['orders-app', 'payments-feature'],
        ruleId: 'domain-boundary',
        message: 'Domain boundary violation',
      },
      {
        type: 'ownership-gap',
        source: 'policy',
        severity: 'warning',
        count: 1,
        projects: ['payments-feature'],
        ruleId: 'ownership-presence',
        message: 'Ownership gap',
      },
    ];
    const measurements: Measurement[] = [
      {
        id: 'm2',
        name: 'Metric 2',
        value: 0.1,
        score: 10,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'm1',
        name: 'Metric 1',
        value: 0.2,
        score: 20,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'm3',
        name: 'Metric 3',
        value: 0.8,
        score: 80,
        maxScore: 100,
        unit: 'ratio',
      },
    ];

    const health = calculateHealthScore(measurements, {}, undefined, {
      topIssues,
    });

    expect(health.hotspots).toEqual(['Metric 2', 'Metric 1']);
    expect(health.metricHotspots).toEqual([
      { id: 'm2', name: 'Metric 2', score: 10 },
      { id: 'm1', name: 'Metric 1', score: 20 },
    ]);
    expect(health.projectHotspots).toEqual([
      {
        project: 'payments-feature',
        count: 3,
        dominantIssueTypes: ['domain-boundary-violation', 'ownership-gap'],
      },
      {
        project: 'orders-app',
        count: 2,
        dominantIssueTypes: ['domain-boundary-violation'],
      },
    ]);
    expect(health.status).toBe('critical');
    expect(health.grade).toBe('F');
    expect(health.explainability.dominantIssues).toEqual(topIssues);
  });

  it('uses metric weights when provided', () => {
    const measurements: Measurement[] = [
      {
        id: 'architectural-entropy',
        name: 'Architectural Entropy',
        value: 0.2,
        score: 20,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'ownership-coverage',
        name: 'Ownership Coverage',
        value: 1,
        score: 100,
        maxScore: 100,
        unit: 'ratio',
      },
    ];

    const health = calculateHealthScore(measurements, {
      'architectural-entropy': 0.9,
      'ownership-coverage': 0.1,
    });

    expect(health.score).toBe(28);
    expect(health.status).toBe('critical');
    expect(health.grade).toBe('F');
  });

  it('uses the configured layer-integrity weight instead of fallback weighting', () => {
    const measurements: Measurement[] = [
      {
        id: 'architectural-entropy',
        name: 'Architectural Entropy',
        value: 0,
        score: 100,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'dependency-complexity',
        name: 'Dependency Complexity',
        value: 0,
        score: 100,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'domain-integrity',
        name: 'Domain Integrity',
        value: 0,
        score: 100,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'ownership-coverage',
        name: 'Ownership Coverage',
        value: 1,
        score: 100,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'documentation-completeness',
        name: 'Documentation Completeness',
        value: 1,
        score: 100,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'layer-integrity',
        name: 'Layer Integrity',
        value: 1,
        score: 0,
        maxScore: 100,
        unit: 'ratio',
      },
    ];

    const health = calculateHealthScore(measurements, {
      'architectural-entropy': 0.2,
      'dependency-complexity': 0.2,
      'domain-integrity': 0.2,
      'ownership-coverage': 0.2,
      'documentation-completeness': 0.2,
      'layer-integrity': 0.2,
    });

    expect(health.score).toBe(83);
    expect(health.status).toBe('warning');
    expect(health.grade).toBe('B');
    expect(health.hotspots).toEqual(['Layer Integrity']);
  });

  it('uses default 85/70 status thresholds at boundary scores', () => {
    const warningHealth = calculateHealthScore([
      {
        id: 'm1',
        name: 'Metric 1',
        value: 0.7,
        score: 70,
        maxScore: 100,
        unit: 'ratio',
      },
    ]);
    const goodHealth = calculateHealthScore([
      {
        id: 'm1',
        name: 'Metric 1',
        value: 0.85,
        score: 85,
        maxScore: 100,
        unit: 'ratio',
      },
    ]);

    expect(warningHealth.status).toBe('warning');
    expect(warningHealth.grade).toBe('C');
    expect(goodHealth.status).toBe('good');
    expect(goodHealth.grade).toBe('B');
  });

  it('uses custom status thresholds when provided', () => {
    const health = calculateHealthScore(
      [
        {
          id: 'm1',
          name: 'Metric 1',
          value: 0.8,
          score: 80,
          maxScore: 100,
          unit: 'ratio',
        },
      ],
      {},
      {
        goodMinScore: 90,
        warningMinScore: 75,
      }
    );

    expect(health.status).toBe('warning');
    expect(health.grade).toBe('B');
  });

  it('emits explainability even when no metric is below hotspot threshold', () => {
    const health = calculateHealthScore([
      {
        id: 'ownership-coverage',
        name: 'Ownership Coverage',
        value: 0.8,
        score: 80,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'domain-integrity',
        name: 'Domain Integrity',
        value: 0.18,
        score: 82,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'dependency-complexity',
        name: 'Dependency Complexity',
        value: 0.15,
        score: 85,
        maxScore: 100,
        unit: 'ratio',
      },
    ]);

    expect(health.metricHotspots).toEqual([]);
    expect(health.explainability.summary).toContain(
      'Overall health is Warning'
    );
    expect(health.explainability.statusReason).toContain(
      'meets the Warning threshold (70)'
    );
    expect(health.explainability.weakestMetrics).toEqual([
      { id: 'ownership-coverage', name: 'Ownership Coverage', score: 80 },
      { id: 'domain-integrity', name: 'Domain Integrity', score: 82 },
      {
        id: 'dependency-complexity',
        name: 'Dependency Complexity',
        score: 85,
      },
    ]);
  });
});

describe('buildRecommendations', () => {
  it('emits recommendations for key violation and metric signals', () => {
    const violations: Violation[] = [
      {
        id: 'v1',
        ruleId: 'domain-boundary',
        project: 'a',
        severity: 'error',
        message: 'cross-domain dependency',
      },
      {
        id: 'v2',
        ruleId: 'ownership-presence',
        project: 'b',
        severity: 'warning',
        message: 'missing ownership',
      },
    ];

    const measurements: Measurement[] = [
      {
        id: 'dependency-complexity',
        name: 'Dependency Complexity',
        value: 0.7,
        score: 40,
        maxScore: 100,
        unit: 'ratio',
      },
    ];

    const recommendations = buildRecommendations(violations, measurements);

    expect(recommendations.map((recommendation) => recommendation.id)).toEqual([
      'reduce-cross-domain-dependencies',
      'improve-ownership-coverage',
      'reduce-dependency-complexity',
    ]);
  });

  it('does not emit reduce-dependency-complexity when score is >= 60', () => {
    const recommendations = buildRecommendations(
      [],
      [
        {
          id: 'dependency-complexity',
          name: 'Dependency Complexity',
          value: 0.3,
          score: 70,
          maxScore: 100,
          unit: 'ratio',
        },
      ]
    );

    expect(
      recommendations.some((r) => r.id === 'reduce-dependency-complexity')
    ).toBe(false);
  });
});

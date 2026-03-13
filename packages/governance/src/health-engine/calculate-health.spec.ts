import { Measurement, Violation } from '../core/index.js';

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
    expect(health.grade).toBe('A');
  });

  it('marks low-scoring metrics as hotspots', () => {
    const measurements: Measurement[] = [
      {
        id: 'm1',
        name: 'Metric 1',
        value: 0.2,
        score: 20,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'm2',
        name: 'Metric 2',
        value: 0.8,
        score: 80,
        maxScore: 100,
        unit: 'ratio',
      },
    ];

    const health = calculateHealthScore(measurements);

    expect(health.hotspots).toEqual(['Metric 1']);
    expect(health.grade).toBe('F');
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
    expect(health.grade).toBe('F');
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

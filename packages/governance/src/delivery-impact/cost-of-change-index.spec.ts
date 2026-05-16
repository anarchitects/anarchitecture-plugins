import type {
  GovernanceAssessment,
  GovernanceExceptionReport,
  GovernanceWorkspace,
  HealthScore,
  Measurement,
  SnapshotComparison,
} from '../core/index.js';
import { calculateCostOfChangeIndex } from './cost-of-change-index.js';

describe('calculateCostOfChangeIndex', () => {
  it('returns low risk for high architecture, ownership, and documentation scores', () => {
    const index = calculateCostOfChangeIndex({
      assessment: createAssessment({
        measurements: [
          measurement('dependency-complexity', 'Dependency Complexity', 'architecture', 0.1, 90),
          measurement('architectural-entropy', 'Architectural Entropy', 'architecture', 0.08, 92),
          measurement('domain-integrity', 'Domain Integrity', 'boundaries', 0.95, 95),
          measurement('layer-integrity', 'Layer Integrity', 'boundaries', 0.93, 93),
          measurement('ownership-coverage', 'Ownership Coverage', 'ownership', 0.96, 96),
          measurement(
            'documentation-completeness',
            'Documentation Completeness',
            'documentation',
            0.98,
            98
          ),
        ],
      }),
    });

    expect(index).toEqual({
      id: 'cost-of-change',
      name: 'Cost of Change Index',
      score: 7,
      risk: 'low',
      trend: 'stable',
      drivers: [
        {
          id: 'change-impact-radius-pressure',
          label: 'Impact radius / blast radius pressure',
          value: 0.1,
          score: 90,
          unit: 'ratio',
          explanation: 'Dependency Complexity score is 90.',
        },
        {
          id: 'cost-of-change-pressure',
          label: 'Cost-of-change pressure',
          value: 0.08,
          score: 92,
          unit: 'ratio',
          explanation: 'Architectural Entropy score is 92.',
        },
        {
          id: 'architectural-erosion-risk',
          label: 'Architectural erosion / change safety risk',
          value: 0.93,
          score: 93,
          unit: 'ratio',
          explanation: 'Layer Integrity score is 93.',
        },
        {
          id: 'cross-domain-coordination-friction',
          label: 'Cross-domain coordination friction',
          value: 0.95,
          score: 95,
          unit: 'ratio',
          explanation: 'Domain Integrity score is 95.',
        },
        {
          id: 'ownership-ambiguity',
          label: 'Ownership ambiguity',
          value: 0.96,
          score: 96,
          unit: 'ratio',
          explanation: 'Ownership Coverage score is 96.',
        },
        {
          id: 'onboarding-friction',
          label: 'Knowledge transfer / onboarding friction',
          value: 0.98,
          score: 98,
          unit: 'ratio',
          explanation: 'Documentation Completeness score is 98.',
        },
      ],
    });
  });

  it('returns high risk for poor dependency, architecture, and ownership scores', () => {
    const index = calculateCostOfChangeIndex({
      assessment: createAssessment({
        measurements: [
          measurement('dependency-complexity', 'Dependency Complexity', 'architecture', 0.8, 20),
          measurement('architectural-entropy', 'Architectural Entropy', 'architecture', 0.75, 25),
          measurement('domain-integrity', 'Domain Integrity', 'boundaries', 0.3, 30),
          measurement('layer-integrity', 'Layer Integrity', 'boundaries', 0.35, 35),
          measurement('ownership-coverage', 'Ownership Coverage', 'ownership', 0.4, 40),
          measurement(
            'documentation-completeness',
            'Documentation Completeness',
            'documentation',
            0.5,
            50
          ),
        ],
      }),
    });

    expect(index.score).toBe(71);
    expect(index.risk).toBe('high');
  });

  it('handles missing optional measurements without throwing', () => {
    expect(() =>
      calculateCostOfChangeIndex({
        assessment: createAssessment({
          measurements: [
            measurement('dependency-complexity', 'Dependency Complexity', 'architecture', 0.5, 50),
          ],
        }),
      })
    ).not.toThrow();

    expect(
      calculateCostOfChangeIndex({
        assessment: createAssessment({
          measurements: [
            measurement('dependency-complexity', 'Dependency Complexity', 'architecture', 0.5, 50),
          ],
        }),
      }).score
    ).toBe(50);
  });

  it('clamps score to 0..100 and applies deterministic rounding', () => {
    const clampedHigh = calculateCostOfChangeIndex({
      assessment: createAssessment({
        measurements: [
          measurement('dependency-complexity', 'Dependency Complexity', 'architecture', 1, -10),
        ],
      }),
    });

    const rounded = calculateCostOfChangeIndex({
      assessment: createAssessment({
        measurements: [
          measurement('dependency-complexity', 'Dependency Complexity', 'architecture', 0.49, 49),
          measurement('architectural-entropy', 'Architectural Entropy', 'architecture', 0.5, 50),
        ],
      }),
    });

    expect(clampedHigh.score).toBe(100);
    expect(rounded.score).toBe(51);
  });

  it('includes only relevant provided drivers', () => {
    const index = calculateCostOfChangeIndex({
      assessment: createAssessment(),
      drivers: [
        {
          id: 'architecture-investment-priority',
          label: 'Prioritized architecture investment drivers',
          value: 3,
          unit: 'count',
        },
        {
          id: 'change-impact-radius-pressure',
          label: 'Impact radius / blast radius pressure',
          score: 44,
          unit: 'score',
        },
        {
          id: 'ownership-ambiguity',
          label: 'Ownership ambiguity',
          score: 66,
          unit: 'score',
        },
      ],
    });

    expect(index.drivers.map((driver) => driver.id)).toEqual([
      'change-impact-radius-pressure',
      'ownership-ambiguity',
    ]);
  });

  it('returns worsening trend when comparison indicates degradation', () => {
    const index = calculateCostOfChangeIndex({
      assessment: createAssessment({
        measurements: [
          measurement('dependency-complexity', 'Dependency Complexity', 'architecture', 0.55, 45),
          measurement('architectural-entropy', 'Architectural Entropy', 'architecture', 0.4, 60),
        ],
      }),
      comparison: createComparison({
        scoreDeltas: [
          {
            id: 'dependency-complexity',
            baseline: 60,
            current: 45,
            delta: -15,
          },
          {
            id: 'architectural-entropy',
            baseline: 68,
            current: 60,
            delta: -8,
          },
        ],
        healthDelta: {
          baselineScore: 78,
          currentScore: 70,
          scoreDelta: -8,
          baselineStatus: 'warning',
          currentStatus: 'warning',
          baselineGrade: 'B',
          currentGrade: 'C',
        },
      }),
    });

    expect(index.trend).toBe('worsening');
  });

  it('returns stable trend when no comparison exists', () => {
    const index = calculateCostOfChangeIndex({
      assessment: createAssessment({
        measurements: [
          measurement('dependency-complexity', 'Dependency Complexity', 'architecture', 0.4, 60),
        ],
      }),
    });

    expect(index.trend).toBe('stable');
  });
});

function createAssessment(
  overrides: Partial<GovernanceAssessment> = {}
): GovernanceAssessment {
  const workspace: GovernanceWorkspace = {
    id: 'workspace',
    name: 'workspace',
    root: '.',
    projects: [],
    dependencies: [],
  };

  const exceptions: GovernanceExceptionReport = {
    summary: {
      declaredCount: 0,
      matchedCount: 0,
      suppressedPolicyViolationCount: 0,
      suppressedConformanceFindingCount: 0,
      unusedExceptionCount: 0,
      activeExceptionCount: 0,
      staleExceptionCount: 0,
      expiredExceptionCount: 0,
      reactivatedPolicyViolationCount: 0,
      reactivatedConformanceFindingCount: 0,
    },
    used: [],
    unused: [],
    suppressedFindings: [],
    reactivatedFindings: [],
  };

  const health: HealthScore = {
    score: 100,
    status: 'good',
    grade: 'A',
    hotspots: [],
    metricHotspots: [],
    projectHotspots: [],
    explainability: {
      summary: 'Healthy.',
      statusReason: 'No governance pressure detected.',
      weakestMetrics: [],
      dominantIssues: [],
    },
  };

  return {
    workspace,
    profile: 'frontend-layered',
    warnings: [],
    exceptions,
    violations: [],
    measurements: [],
    signalBreakdown: {
      total: 0,
      bySource: [
        { source: 'graph', count: 0 },
        { source: 'conformance', count: 0 },
        { source: 'policy', count: 0 },
        { source: 'extension', count: 0 },
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
    topIssues: [],
    health,
    recommendations: [],
    ...overrides,
  };
}

function measurement(
  id: string,
  name: string,
  family: Measurement['family'],
  value: number,
  score: number
): Measurement {
  return {
    id,
    name,
    family,
    value,
    score,
    maxScore: 100,
    unit: 'ratio',
  };
}

function createComparison(
  overrides: Partial<SnapshotComparison> = {}
): SnapshotComparison {
  return {
    baseline: {
      timestamp: '2026-05-01T00:00:00.000Z',
      repo: 'repo',
      branch: 'main',
      commitSha: 'abc',
      pluginVersion: '0.8.0',
      metricSchemaVersion: '1.1',
      metrics: {},
      scores: {},
      violations: [],
    },
    current: {
      timestamp: '2026-05-02T00:00:00.000Z',
      repo: 'repo',
      branch: 'main',
      commitSha: 'def',
      pluginVersion: '0.8.0',
      metricSchemaVersion: '1.1',
      metrics: {},
      scores: {},
      violations: [],
    },
    metricDeltas: [],
    scoreDeltas: [],
    newViolations: [],
    resolvedViolations: [],
    ...overrides,
  };
}

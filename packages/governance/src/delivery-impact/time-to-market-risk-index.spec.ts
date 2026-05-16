import type {
  GovernanceAssessment,
  GovernanceExceptionReport,
  GovernanceTopIssue,
  GovernanceWorkspace,
  HealthScore,
  Measurement,
  SnapshotComparison,
  Violation,
} from '../core/index.js';
import { calculateTimeToMarketRiskIndex } from './time-to-market-risk-index.js';

describe('calculateTimeToMarketRiskIndex', () => {
  it('returns low risk for high domain, layer, ownership, and dependency health', () => {
    const index = calculateTimeToMarketRiskIndex({
      assessment: createAssessment({
        measurements: [
          measurement('domain-integrity', 'Domain Integrity', 'boundaries', 0.95, 95),
          measurement('ownership-coverage', 'Ownership Coverage', 'ownership', 0.96, 96),
          measurement('dependency-complexity', 'Dependency Complexity', 'architecture', 0.12, 88),
          measurement('layer-integrity', 'Layer Integrity', 'boundaries', 0.92, 92),
          measurement(
            'documentation-completeness',
            'Documentation Completeness',
            'documentation',
            0.94,
            94
          ),
        ],
        health: health(94, 'good', 'A'),
      }),
    });

    expect(index.score).toBe(6);
    expect(index.risk).toBe('low');
    expect(index.trend).toBe('stable');
  });

  it('returns high risk for boundary violations, ownership ambiguity, and dependency pressure', () => {
    const index = calculateTimeToMarketRiskIndex({
      assessment: createAssessment({
        measurements: [
          measurement('domain-integrity', 'Domain Integrity', 'boundaries', 0.1, 10),
          measurement('ownership-coverage', 'Ownership Coverage', 'ownership', 0.2, 20),
          measurement('dependency-complexity', 'Dependency Complexity', 'architecture', 0.85, 15),
          measurement('layer-integrity', 'Layer Integrity', 'boundaries', 0.2, 20),
        ],
        health: health(35, 'critical', 'D'),
        topIssues: [
          topIssue(
            'domain-boundary-violation',
            3,
            'Cross-domain dependency violates declared boundary.'
          ),
          topIssue('ownership-gap', 2, 'Ownership coverage is incomplete.'),
          topIssue('structural-dependency', 4, 'Structural dependency fanout is increasing.'),
          topIssue('conformance-violation', 2, 'Conformance guard failed.'),
        ],
        violations: [
          violation('conformance-rule', 'compliance', 'Conformance guard failed.'),
        ],
      }),
    });

    expect(index.score).toBe(79);
    expect(index.risk).toBe('high');
  });

  it('handles missing optional measurements without throwing', () => {
    expect(() =>
      calculateTimeToMarketRiskIndex({
        assessment: createAssessment({
          health: health(72, 'warning', 'C'),
        }),
      })
    ).not.toThrow();

    expect(
      calculateTimeToMarketRiskIndex({
        assessment: createAssessment({
          health: health(72, 'warning', 'C'),
        }),
      }).score
    ).toBe(21);
  });

  it('clamps score to 0..100 and applies deterministic rounding', () => {
    const clamped = calculateTimeToMarketRiskIndex({
      assessment: createAssessment({
        measurements: [
          measurement('domain-integrity', 'Domain Integrity', 'boundaries', 1, -20),
          measurement('ownership-coverage', 'Ownership Coverage', 'ownership', 1, -15),
        ],
        health: health(0, 'critical', 'F'),
        topIssues: [
          topIssue('conformance-violation', 5, 'Conformance guard failed.'),
        ],
      }),
    });

    const rounded = calculateTimeToMarketRiskIndex({
      assessment: createAssessment({
        measurements: [
          measurement('domain-integrity', 'Domain Integrity', 'boundaries', 0.51, 49),
          measurement('ownership-coverage', 'Ownership Coverage', 'ownership', 0.51, 49),
        ],
        health: health(51, 'warning', 'C'),
      }),
    });

    expect(clamped.score).toBe(100);
    expect(rounded.score).toBe(47);
  });

  it('includes relevant delivery-impact drivers in deterministic order', () => {
    const index = calculateTimeToMarketRiskIndex({
      assessment: createAssessment(),
      drivers: [
        {
          id: 'delivery-predictability-pressure',
          label: 'Delivery predictability pressure',
          score: 70,
          unit: 'score',
        },
        {
          id: 'ownership-ambiguity',
          label: 'Ownership ambiguity',
          score: 66,
          unit: 'score',
        },
        {
          id: 'architecture-investment-priority',
          label: 'Prioritized architecture investment drivers',
          value: 3,
          unit: 'count',
        },
        {
          id: 'cross-domain-coordination-friction',
          label: 'Cross-domain coordination friction',
          score: 55,
          unit: 'score',
        },
      ],
    });

    expect(index.drivers.map((driver) => driver.id)).toEqual([
      'cross-domain-coordination-friction',
      'ownership-ambiguity',
      'delivery-predictability-pressure',
      'architecture-investment-priority',
    ]);
  });

  it('returns worsening trend when comparison indicates degradation', () => {
    const index = calculateTimeToMarketRiskIndex({
      assessment: createAssessment({
        measurements: [
          measurement('domain-integrity', 'Domain Integrity', 'boundaries', 0.45, 55),
          measurement('ownership-coverage', 'Ownership Coverage', 'ownership', 0.5, 50),
          measurement('dependency-complexity', 'Dependency Complexity', 'architecture', 0.55, 45),
        ],
        health: health(60, 'warning', 'C'),
      }),
      comparison: createComparison({
        scoreDeltas: [
          {
            id: 'domain-integrity',
            baseline: 70,
            current: 55,
            delta: -15,
          },
          {
            id: 'ownership-coverage',
            baseline: 62,
            current: 50,
            delta: -12,
          },
        ],
        healthDelta: {
          baselineScore: 72,
          currentScore: 60,
          scoreDelta: -12,
          baselineStatus: 'warning',
          currentStatus: 'warning',
          baselineGrade: 'B',
          currentGrade: 'C',
        },
        topIssueDeltas: [
          {
            type: 'domain-boundary-violation',
            source: 'policy',
            severity: 'error',
            message: 'Cross-domain dependency violates declared boundary.',
            baselineCount: 1,
            currentCount: 3,
            delta: 2,
            projects: ['a', 'b'],
          },
        ],
      }),
    });

    expect(index.trend).toBe('worsening');
  });

  it('returns stable trend when no comparison exists', () => {
    const index = calculateTimeToMarketRiskIndex({
      assessment: createAssessment({
        measurements: [
          measurement('domain-integrity', 'Domain Integrity', 'boundaries', 0.4, 60),
        ],
      }),
    });

    expect(index.trend).toBe('stable');
  });

  it('returns deterministic output ordering for derived drivers', () => {
    const index = calculateTimeToMarketRiskIndex({
      assessment: createAssessment({
        measurements: [
          measurement('domain-integrity', 'Domain Integrity', 'boundaries', 0.8, 80),
          measurement('ownership-coverage', 'Ownership Coverage', 'ownership', 0.7, 70),
          measurement('dependency-complexity', 'Dependency Complexity', 'architecture', 0.5, 50),
          measurement('layer-integrity', 'Layer Integrity', 'boundaries', 0.6, 60),
        ],
        health: health(68, 'warning', 'C'),
        topIssues: [
          topIssue('ownership-gap', 1, 'Ownership coverage is incomplete.'),
        ],
      }),
    });

    expect(index.drivers.map((driver) => driver.id)).toEqual([
      'cross-domain-coordination-friction',
      'ownership-ambiguity',
      'change-impact-radius-pressure',
      'architectural-erosion-risk',
      'delivery-predictability-pressure',
      'architecture-investment-priority',
    ]);
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
    health: health(100, 'good', 'A'),
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

function topIssue(
  type: GovernanceTopIssue['type'],
  count: number,
  message: string
): GovernanceTopIssue {
  return {
    type,
    source: 'policy',
    severity: 'warning',
    count,
    projects: ['a'],
    message,
  };
}

function violation(
  ruleId: string,
  category: Violation['category'],
  message: string
): Violation {
  return {
    id: ruleId,
    ruleId,
    project: 'a',
    severity: 'warning',
    category,
    message,
  };
}

function health(
  score: number,
  status: HealthScore['status'],
  grade: HealthScore['grade']
): HealthScore {
  return {
    score,
    status,
    grade,
    hotspots: [],
    metricHotspots: [],
    projectHotspots: [],
    explainability: {
      summary: 'Health summary.',
      statusReason: 'Health status reason.',
      weakestMetrics: [],
      dominantIssues: [],
    },
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

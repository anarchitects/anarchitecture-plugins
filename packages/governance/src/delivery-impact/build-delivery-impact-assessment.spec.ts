import type {
  GovernanceAssessment,
  GovernanceExceptionReport,
  GovernanceTopIssue,
  GovernanceWorkspace,
  HealthScore,
  Measurement,
  Violation,
} from '../core/index.js';
import { buildDeliveryImpactAssessment } from './build-delivery-impact-assessment.js';
import type { FeatureImpactAssessment } from './feature-impact-assessment.js';

describe('buildDeliveryImpactAssessment', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-16T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds a delivery impact assessment with cost of change and time-to-market indices', () => {
    const result = buildDeliveryImpactAssessment({
      assessment: createAssessment({
        measurements: [
          measurement(
            'dependency-complexity',
            'Dependency Complexity',
            'architecture',
            0.55,
            45
          ),
          measurement(
            'architectural-entropy',
            'Architectural Entropy',
            'architecture',
            0.4,
            60
          ),
          measurement(
            'domain-integrity',
            'Domain Integrity',
            'boundaries',
            0.5,
            50
          ),
          measurement(
            'layer-integrity',
            'Layer Integrity',
            'boundaries',
            0.65,
            35
          ),
          measurement(
            'ownership-coverage',
            'Ownership Coverage',
            'ownership',
            0.7,
            30
          ),
          measurement(
            'documentation-completeness',
            'Documentation Completeness',
            'documentation',
            0.8,
            20
          ),
        ],
        health: health(55, 'warning', 'C'),
      }),
    });

    expect(result.generatedAt).toBe('2026-05-16T12:00:00.000Z');
    expect(result.profile).toBe('frontend-layered');
    expect(result.indices.map((index) => index.id)).toEqual([
      'cost-of-change',
      'time-to-market-risk',
    ]);
  });

  it('includes mapped drivers', () => {
    const result = buildDeliveryImpactAssessment({
      assessment: createAssessment({
        measurements: [
          measurement(
            'domain-integrity',
            'Domain Integrity',
            'boundaries',
            0.6,
            40
          ),
          measurement(
            'ownership-coverage',
            'Ownership Coverage',
            'ownership',
            0.7,
            30
          ),
          measurement(
            'dependency-complexity',
            'Dependency Complexity',
            'architecture',
            0.5,
            50
          ),
        ],
        topIssues: [
          topIssue(
            'domain-boundary-violation',
            2,
            'Cross-domain dependency violates declared boundary.'
          ),
          topIssue('ownership-gap', 1, 'Ownership coverage is incomplete.'),
          topIssue(
            'structural-dependency',
            3,
            'Structural dependency fanout is increasing.'
          ),
        ],
      }),
    });

    expect(result.drivers.map((driver) => driver.id)).toEqual([
      'cross-domain-coordination-friction',
      'ownership-ambiguity',
      'change-impact-radius-pressure',
      'architecture-investment-priority',
    ]);
  });

  it('creates management insights for medium/high risk indices', () => {
    const result = buildDeliveryImpactAssessment({
      assessment: createAssessment({
        measurements: [
          measurement(
            'dependency-complexity',
            'Dependency Complexity',
            'architecture',
            0.7,
            20
          ),
          measurement(
            'architectural-entropy',
            'Architectural Entropy',
            'architecture',
            0.75,
            25
          ),
          measurement(
            'domain-integrity',
            'Domain Integrity',
            'boundaries',
            0.3,
            30
          ),
          measurement(
            'ownership-coverage',
            'Ownership Coverage',
            'ownership',
            0.4,
            40
          ),
        ],
        health: health(45, 'warning', 'C'),
        topIssues: [
          topIssue(
            'domain-boundary-violation',
            2,
            'Cross-domain dependency violates declared boundary.'
          ),
        ],
      }),
    });

    expect(result.insights.map((insight) => insight.id)).toContain(
      'cost-of-change-risk'
    );
    expect(result.insights.map((insight) => insight.id)).toContain(
      'time-to-market-risk'
    );
  });

  it('does not emit noisy management insights for low-risk indices', () => {
    const result = buildDeliveryImpactAssessment({
      assessment: createAssessment({
        measurements: [
          measurement(
            'dependency-complexity',
            'Dependency Complexity',
            'architecture',
            0.1,
            90
          ),
          measurement(
            'architectural-entropy',
            'Architectural Entropy',
            'architecture',
            0.08,
            92
          ),
          measurement(
            'domain-integrity',
            'Domain Integrity',
            'boundaries',
            0.95,
            95
          ),
          measurement(
            'ownership-coverage',
            'Ownership Coverage',
            'ownership',
            0.96,
            96
          ),
        ],
        health: health(96, 'good', 'A'),
      }),
    });

    expect(result.insights.map((insight) => insight.id)).not.toContain(
      'cost-of-change-risk'
    );
    expect(result.insights.map((insight) => insight.id)).not.toContain(
      'time-to-market-risk'
    );
  });

  it('includes optional feature impact only when provided', () => {
    const featureImpact = createFeatureImpactAssessment();
    const result = buildDeliveryImpactAssessment({
      assessment: createAssessment({
        measurements: [
          measurement(
            'domain-integrity',
            'Domain Integrity',
            'boundaries',
            0.6,
            40
          ),
        ],
      }),
      featureImpact,
    });

    expect(result.drivers.map((driver) => driver.id)).toContain(
      'feature-impact-radius'
    );
    expect(
      result.insights
        .find((insight) => insight.id === 'delivery-impact-technical-findings')
        ?.drivers.map((driver) => driver.id)
    ).toContain('feature-impact-radius');
  });

  it('handles a minimal assessment without throwing', () => {
    expect(() =>
      buildDeliveryImpactAssessment({
        assessment: createAssessment(),
      })
    ).not.toThrow();

    expect(
      buildDeliveryImpactAssessment({
        assessment: createAssessment(),
      })
    ).toEqual({
      generatedAt: '2026-05-16T12:00:00.000Z',
      profile: 'frontend-layered',
      indices: [
        {
          id: 'cost-of-change',
          name: 'Cost of Change Index',
          score: 0,
          risk: 'low',
          trend: 'stable',
          drivers: [],
        },
        {
          id: 'time-to-market-risk',
          name: 'Time-to-Market Risk Index',
          score: 0,
          risk: 'low',
          trend: 'stable',
          drivers: [],
        },
      ],
      insights: [],
      drivers: [],
    });
  });

  it('returns deterministic ordering', () => {
    const result = buildDeliveryImpactAssessment({
      assessment: createAssessment({
        measurements: [
          measurement(
            'domain-integrity',
            'Domain Integrity',
            'boundaries',
            0.6,
            40
          ),
          measurement(
            'ownership-coverage',
            'Ownership Coverage',
            'ownership',
            0.7,
            30
          ),
          measurement(
            'dependency-complexity',
            'Dependency Complexity',
            'architecture',
            0.5,
            50
          ),
        ],
        health: health(60, 'warning', 'C'),
        topIssues: [
          topIssue('ownership-gap', 1, 'Ownership coverage is incomplete.'),
          topIssue(
            'domain-boundary-violation',
            2,
            'Cross-domain dependency violates declared boundary.'
          ),
        ],
        violations: [
          violation(
            'domain-boundary',
            'boundary',
            'Cross-domain dependency violates declared boundary.'
          ),
        ],
      }),
      featureImpact: createFeatureImpactAssessment(),
    });

    expect(result.indices.map((index) => index.id)).toEqual([
      'cost-of-change',
      'time-to-market-risk',
    ]);
    expect(result.insights.map((insight) => insight.id)).toEqual([
      'cost-of-change-risk',
      'time-to-market-risk',
      'architecture-investment-drivers',
      'delivery-impact-technical-findings',
    ]);
    expect(result.drivers.map((driver) => driver.id)).toEqual([
      'cross-domain-coordination-friction',
      'ownership-ambiguity',
      'change-impact-radius-pressure',
      'delivery-predictability-pressure',
      'architecture-investment-priority',
      'feature-impact-radius',
      'feature-cross-domain-impact',
      'feature-review-stakeholder-spread',
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

function createFeatureImpactAssessment(): FeatureImpactAssessment {
  return {
    id: 'feature-impact',
    changedProjects: ['billing-ui'],
    affectedProjects: ['billing-ui', 'payments-api'],
    affectedDomains: ['billing', 'payments'],
    affectedTeams: ['@org/billing', '@org/payments'],
    affectedRules: [],
    impactRadius: 4,
    deliveryRisk: 'medium',
    recommendedReviewStakeholders: ['@org/billing', '@org/payments', 'alice'],
    drivers: [
      {
        id: 'feature-impact-radius',
        label: 'Feature impact radius',
        value: 4,
        unit: 'count',
      },
      {
        id: 'feature-cross-domain-impact',
        label: 'Feature cross-domain impact',
        value: 2,
        unit: 'count',
      },
      {
        id: 'feature-review-stakeholder-spread',
        label: 'Feature review stakeholder spread',
        value: 3,
        unit: 'count',
      },
    ],
  };
}

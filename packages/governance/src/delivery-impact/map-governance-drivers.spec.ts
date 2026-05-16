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
import { mapGovernanceDrivers } from './map-governance-drivers.js';

describe('mapGovernanceDrivers', () => {
  it('maps ownership-related metrics and issues to ownership-ambiguity', () => {
    const drivers = mapGovernanceDrivers({
      assessment: createAssessment({
        measurements: [
          measurement('ownership-coverage', 'Ownership Coverage', 'ownership', 0.66, 66),
        ],
        topIssues: [
          topIssue('ownership-gap', 2, 'Ownership coverage is incomplete.'),
        ],
      }),
    });

    expect(drivers).toContainEqual({
      id: 'ownership-ambiguity',
      label: 'Ownership ambiguity',
      value: 0.66,
      score: 66,
      unit: 'ratio',
      trend: undefined,
      explanation: 'Ownership Coverage score is 66 with 2 ownership issues.',
    });
  });

  it('maps boundary-related issues to cross-domain and architectural erosion drivers', () => {
    const drivers = mapGovernanceDrivers({
      assessment: createAssessment({
        measurements: [
          measurement('domain-integrity', 'Domain Integrity', 'boundaries', 0.82, 82),
          measurement('layer-integrity', 'Layer Integrity', 'boundaries', 0.9, 90),
        ],
        topIssues: [
          topIssue(
            'domain-boundary-violation',
            3,
            'Cross-domain dependency violates declared boundary.'
          ),
          topIssue(
            'layer-boundary-violation',
            1,
            'Layer boundary violation increases change risk.'
          ),
        ],
      }),
    });

    expect(drivers.map((driver) => driver.id)).toEqual([
      'cross-domain-coordination-friction',
      'architectural-erosion-risk',
      'architecture-investment-priority',
    ]);
  });

  it('maps dependency and coupling findings to change-impact-radius-pressure', () => {
    const drivers = mapGovernanceDrivers({
      assessment: createAssessment({
        measurements: [
          measurement(
            'dependency-complexity',
            'Dependency Complexity',
            'architecture',
            0.44,
            56
          ),
        ],
        topIssues: [
          topIssue(
            'structural-dependency',
            4,
            'Structural dependency fanout is increasing.'
          ),
        ],
      }),
    });

    expect(drivers).toContainEqual({
      id: 'change-impact-radius-pressure',
      label: 'Impact radius / blast radius pressure',
      value: 0.44,
      score: 56,
      unit: 'ratio',
      trend: undefined,
      explanation: 'Dependency Complexity score is 56 with 4 dependency hotspots.',
    });
  });

  it('maps snapshot health degradation to a worsening delivery predictability driver', () => {
    const drivers = mapGovernanceDrivers({
      assessment: createAssessment({
        health: {
          score: 72,
          status: 'warning',
          grade: 'C',
          hotspots: [],
          metricHotspots: [],
          projectHotspots: [],
          explainability: {
            summary: 'Health is under pressure.',
            statusReason: 'Boundary and ownership pressure remain active.',
            weakestMetrics: [],
            dominantIssues: [],
          },
        },
      }),
      comparison: createComparison({
        healthDelta: {
          baselineScore: 78,
          currentScore: 72,
          scoreDelta: -6,
          baselineStatus: 'warning',
          currentStatus: 'warning',
          baselineGrade: 'B',
          currentGrade: 'C',
        },
      }),
    });

    expect(drivers).toContainEqual({
      id: 'delivery-predictability-pressure',
      label: 'Delivery predictability pressure',
      value: 72,
      score: 72,
      unit: 'score',
      trend: 'worsening',
      explanation: 'Health score is 72 with warning status.',
    });
  });

  it('returns deterministic ordering across mixed drivers', () => {
    const drivers = mapGovernanceDrivers({
      assessment: createAssessment({
        measurements: [
          measurement('dependency-complexity', 'Dependency Complexity', 'architecture', 0.4, 60),
          measurement('domain-integrity', 'Domain Integrity', 'boundaries', 0.9, 90),
          measurement('ownership-coverage', 'Ownership Coverage', 'ownership', 0.8, 80),
          measurement(
            'documentation-completeness',
            'Documentation Completeness',
            'documentation',
            0.75,
            75
          ),
          measurement('architectural-entropy', 'Architectural Entropy', 'architecture', 0.2, 80),
        ],
        topIssues: [
          topIssue('ownership-gap', 1, 'Ownership is incomplete.'),
          topIssue(
            'domain-boundary-violation',
            2,
            'Cross-domain dependency violates declared boundary.'
          ),
          topIssue('structural-dependency', 3, 'Structural dependency fanout is increasing.'),
        ],
        violations: [
          violation('docs-stale', 'documentation', 'Shared library docs are stale.'),
        ],
      }),
    });

    expect(drivers.map((driver) => driver.id)).toEqual([
      'cross-domain-coordination-friction',
      'ownership-ambiguity',
      'change-impact-radius-pressure',
      'cost-of-change-pressure',
      'onboarding-friction',
      'architecture-investment-priority',
    ]);
  });

  it('returns an empty array for a clean minimal assessment', () => {
    expect(
      mapGovernanceDrivers({
        assessment: createAssessment(),
      })
    ).toEqual([]);
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

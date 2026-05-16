import type {
  GovernanceAssessment,
  SnapshotComparison,
} from '../core/index.js';
import type { DeliveryImpactAssessment } from '../delivery-impact/index.js';

import {
  buildManagementInsightsAiRequest,
  buildManagementInsightsPrompt,
  summarizeManagementInsights,
} from './management-insights.js';

describe('management insights AI analysis builders', () => {
  const deliveryImpact: DeliveryImpactAssessment = {
    generatedAt: '2026-05-16T09:00:00.000Z',
    profile: 'frontend-layered',
    indices: [
      {
        id: 'time-to-market-risk',
        name: 'Time-to-Market Risk Index',
        score: 72,
        risk: 'high',
        trend: 'worsening',
        drivers: [
          {
            id: 'cross-domain-coordination-friction',
            label: 'Cross-domain coordination friction',
            score: 88,
            unit: 'score',
            explanation: 'Boundary signals are increasing across domains.',
          },
        ],
      },
      {
        id: 'cost-of-change',
        name: 'Cost of Change Index',
        score: 61,
        risk: 'medium',
        drivers: [
          {
            id: 'cost-of-change-pressure',
            label: 'Cost-of-change pressure',
            score: 74,
            unit: 'score',
          },
        ],
      },
    ],
    insights: [
      {
        id: 'time-to-market-risk',
        audience: 'management',
        category: 'time-to-market',
        severity: 'high',
        title: 'Time-to-market risk is elevated',
        summary:
          'Cross-domain coordination and ownership ambiguity are increasing delivery friction.',
        drivers: [
          {
            id: 'cross-domain-coordination-friction',
            label: 'Cross-domain coordination friction',
            score: 88,
            unit: 'score',
          },
        ],
        relatedMeasurements: ['domain-integrity'],
        relatedSignals: ['domain-boundary-violation'],
        relatedViolations: ['domain-boundary:platform-shell:checkout-api'],
      },
      {
        id: 'architecture-investment-drivers',
        audience: 'technical-lead',
        category: 'delivery-risk',
        severity: 'medium',
        title:
          'Architecture investment should focus on coordination boundaries',
        summary:
          'Reduce coupling and clarify ownership on shared integration points.',
        drivers: [
          {
            id: 'ownership-ambiguity',
            label: 'Ownership ambiguity',
            score: 66,
            unit: 'score',
          },
        ],
        relatedMeasurements: ['ownership-coverage'],
        relatedSignals: ['ownership-missing'],
        relatedViolations: ['ownership-required:checkout-api'],
      },
    ],
    drivers: [
      {
        id: 'cross-domain-coordination-friction',
        label: 'Cross-domain coordination friction',
        score: 88,
        unit: 'score',
        trend: 'worsening',
        explanation: 'Boundary signals are increasing across domains.',
      },
      {
        id: 'ownership-ambiguity',
        label: 'Ownership ambiguity',
        score: 66,
        unit: 'score',
      },
    ],
  };

  const assessment: GovernanceAssessment = {
    workspace: {
      id: 'workspace',
      name: 'workspace',
      root: '.',
      projects: [],
      dependencies: [],
    },
    profile: 'frontend-layered',
    warnings: ['Boundary profile uses default thresholds.'],
    exceptions: {
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
    },
    violations: [
      {
        id: 'domain-boundary:platform-shell:checkout-api',
        ruleId: 'domain-boundary',
        project: 'platform-shell',
        severity: 'error',
        category: 'architecture',
        message: 'Platform shell depends on checkout API.',
      },
    ],
    measurements: [
      {
        id: 'domain-integrity',
        name: 'Domain Integrity',
        family: 'boundaries',
        value: 0.58,
        score: 58,
        maxScore: 100,
        unit: 'score',
      },
      {
        id: 'ownership-coverage',
        name: 'Ownership Coverage',
        family: 'ownership',
        value: 0.74,
        score: 74,
        maxScore: 100,
        unit: 'score',
      },
    ],
    signalBreakdown: {
      total: 2,
      bySource: [{ source: 'policy', count: 2 }],
      byType: [
        { type: 'domain-boundary-violation', count: 1 },
        { type: 'ownership-missing', count: 1 },
      ],
      bySeverity: [
        { severity: 'error', count: 1 },
        { severity: 'warning', count: 1 },
      ],
    },
    metricBreakdown: {
      families: [],
    },
    topIssues: [
      {
        type: 'domain-boundary-violation',
        source: 'policy',
        severity: 'error',
        count: 1,
        projects: ['platform-shell'],
        ruleId: 'domain-boundary',
        message: 'Platform shell depends on checkout API.',
      },
    ],
    health: {
      score: 68,
      status: 'warning',
      grade: 'C',
      hotspots: ['platform-shell'],
      metricHotspots: [],
      projectHotspots: [],
      explainability: {
        summary: 'Boundary and ownership pressure is visible.',
        statusReason: 'Domain integrity score is below threshold.',
        weakestMetrics: [],
        dominantIssues: [],
      },
    },
    recommendations: [],
  };

  const comparison: SnapshotComparison = {
    baseline: {
      timestamp: '2026-05-10T09:00:00.000Z',
      repo: 'repo',
      branch: 'main',
      commitSha: 'abc123',
      pluginVersion: '0.1.0',
      metricSchemaVersion: '1.2',
      metrics: {},
      scores: {},
      violations: [],
    },
    current: {
      timestamp: '2026-05-16T09:00:00.000Z',
      repo: 'repo',
      branch: 'main',
      commitSha: 'def456',
      pluginVersion: '0.1.0',
      metricSchemaVersion: '1.2',
      metrics: {},
      scores: {},
      violations: [],
    },
    metricDeltas: [],
    scoreDeltas: [],
    newViolations: [],
    resolvedViolations: [],
    healthDelta: {
      baselineScore: 72,
      currentScore: 68,
      scoreDelta: -4,
      baselineStatus: 'warning',
      currentStatus: 'warning',
      baselineGrade: 'C',
      currentGrade: 'C',
    },
    deliveryImpactIndexDeltas: [
      {
        id: 'time-to-market-risk',
        baselineScore: 66,
        currentScore: 72,
        scoreDelta: 6,
        baselineRisk: 'medium',
        currentRisk: 'high',
      },
    ],
  };

  it('builds a deterministic management-insights AI request with grounded delivery-impact content', () => {
    const request = buildManagementInsightsAiRequest({
      deliveryImpact,
      assessment,
      comparison,
      generatedAt: '2026-05-16T10:00:00.000Z',
      metadata: {
        source: 'test',
      },
    });

    expect(request.kind).toBe('management-insights');
    expect(request.generatedAt).toBe('2026-05-16T10:00:00.000Z');
    expect(request.profile).toBe('frontend-layered');
    expect(request.inputs.metadata).toEqual(
      expect.objectContaining({
        source: 'test',
        deliveryImpact: expect.objectContaining({
          indices: [
            expect.objectContaining({ id: 'cost-of-change' }),
            expect.objectContaining({ id: 'time-to-market-risk' }),
          ],
          drivers: [
            expect.objectContaining({
              id: 'cross-domain-coordination-friction',
            }),
            expect.objectContaining({ id: 'ownership-ambiguity' }),
          ],
        }),
        governanceSummary: expect.objectContaining({
          totalViolationCount: 1,
          topIssues: [expect.objectContaining({ ruleId: 'domain-boundary' })],
        }),
        comparisonSummary: expect.objectContaining({
          deliveryImpactIndexDeltas: [
            expect.objectContaining({
              id: 'time-to-market-risk',
              scoreDelta: 6,
            }),
          ],
        }),
      })
    );
  });

  it('builds a deterministic prompt with grounding and anti-forecast instructions', () => {
    const request = buildManagementInsightsAiRequest({
      deliveryImpact,
      generatedAt: '2026-05-16T10:00:00.000Z',
    });

    const prompt = buildManagementInsightsPrompt({ request });

    expect(prompt).toContain(
      'Use only the information provided in the payload JSON.'
    );
    expect(prompt).toContain('not financial estimates');
    expect(prompt).toContain('not a delivery-date forecast');
    expect(prompt).toContain('Do not claim exact financial cost');
    expect(prompt).toContain('Technical Lead Actions');
  });

  it('summarizes management insights without requiring Nx, file IO, or logger behavior', () => {
    const request = buildManagementInsightsAiRequest({
      deliveryImpact,
      assessment,
      comparison,
      generatedAt: '2026-05-16T10:00:00.000Z',
    });

    const analysis = summarizeManagementInsights(request);

    expect(analysis.kind).toBe('management-insights');
    expect(analysis.summary).toContain('Highest current pressure');
    expect(analysis.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'index-time-to-market-risk',
        }),
      ])
    );
    expect(analysis.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'time-to-market-risk',
          priority: 'high',
        }),
      ])
    );
  });

  it('handles missing optional assessment and comparison inputs without throwing', () => {
    const request = buildManagementInsightsAiRequest({
      deliveryImpact,
      generatedAt: '2026-05-16T10:00:00.000Z',
    });

    expect(() => summarizeManagementInsights(request)).not.toThrow();
    expect(request.inputs.metadata).toEqual(
      expect.objectContaining({
        traceability: expect.objectContaining({
          comparisonIncluded: false,
        }),
      })
    );
  });
});

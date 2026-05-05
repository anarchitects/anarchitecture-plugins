import { AiAnalysisRequest, SnapshotViolation } from '../core/index.js';

import {
  summarizeArchitectureRecommendations,
  rankTopViolations,
  summarizeCognitiveLoad,
  summarizeOnboarding,
  summarizeScorecard,
  summarizeRefactoringSuggestions,
  summarizeSmellClusters,
  summarizePrImpact,
  summarizeRootCause,
} from './index.js';

describe('ai-analysis', () => {
  it('ranks violations by severity and then deterministic key', () => {
    const violations: SnapshotViolation[] = [
      {
        type: 'ownership-presence',
        source: 'libs/b',
        severity: 'warning',
      },
      {
        type: 'domain-boundary',
        source: 'libs/a',
        severity: 'error',
      },
      {
        type: 'layer-boundary',
        source: 'libs/c',
        severity: 'info',
      },
    ];

    const ranked = rankTopViolations(violations, 2);

    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.type).toBe('domain-boundary');
    expect(ranked[1]?.type).toBe('ownership-presence');
  });

  it('builds deterministic root-cause findings and recommendations', () => {
    const request: AiAnalysisRequest = {
      kind: 'root-cause',
      generatedAt: '2026-03-13T12:00:00Z',
      profile: 'frontend-layered',
      inputs: {
        topViolations: [
          {
            type: 'domain-boundary',
            source: 'libs/shared/ui-utils',
            severity: 'error',
          },
          {
            type: 'domain-boundary',
            source: 'libs/shared/ui-utils',
            severity: 'error',
          },
          {
            type: 'ownership-presence',
            source: 'libs/orders/state',
            severity: 'warning',
          },
        ],
      },
    };

    const result = summarizeRootCause(request);

    expect(result.kind).toBe('root-cause');
    expect(result.findings[0]?.title).toContain('libs/shared/ui-utils');
    expect(
      result.recommendations.some(
        (recommendation) =>
          recommendation.id === 'review-cross-domain-contracts'
      )
    ).toBe(true);
    expect(
      result.recommendations.some(
        (recommendation) => recommendation.id === 'fill-ownership-gaps'
      )
    ).toBe(true);
  });

  it('classifies PR impact risk using deterministic metadata signals', () => {
    const request: AiAnalysisRequest = {
      kind: 'pr-impact',
      generatedAt: '2026-03-13T12:00:00Z',
      profile: 'frontend-layered',
      inputs: {
        affectedProjects: ['orders-state', 'payments-api', 'shared-utils'],
        metadata: {
          changedFilesCount: 22,
          affectedProjectsCount: 5,
          affectedDomainCount: 3,
          crossDomainDependencyEdges: 2,
        },
      },
    };

    const result = summarizePrImpact(request);

    expect(result.kind).toBe('pr-impact');
    expect(result.metadata?.risk).toBe('high');
    expect(
      result.recommendations.some(
        (recommendation) => recommendation.id === 'split-pr-by-domain'
      )
    ).toBe(true);
  });

  it('classifies cognitive load risk from deterministic coupling and fanout signals', () => {
    const request: AiAnalysisRequest = {
      kind: 'cognitive-load',
      generatedAt: '2026-03-13T12:00:00Z',
      profile: 'frontend-layered',
      inputs: {
        affectedProjects: ['booking-state', 'payments-api', 'shared-utils'],
        metadata: {
          selectedProjectsCount: 9,
          affectedDomainCount: 3,
          crossDomainDependencyEdges: 5,
          averageFanout: 4.2,
          maxFanout: 11,
        },
      },
    };

    const result = summarizeCognitiveLoad(request);

    expect(result.kind).toBe('cognitive-load');
    expect(result.metadata?.risk).toBe('medium');
    expect(
      result.recommendations.some(
        (recommendation) =>
          recommendation.id === 'stabilize-cross-domain-contracts'
      )
    ).toBe(true);
  });

  it('generates architecture recommendations from prioritized violations and trend metadata', () => {
    const request: AiAnalysisRequest = {
      kind: 'recommendations',
      generatedAt: '2026-03-13T12:00:00Z',
      profile: 'frontend-layered',
      inputs: {
        topViolations: [
          {
            type: 'domain-boundary',
            source: 'libs/orders/state',
            target: 'libs/customer/api',
            severity: 'error',
          },
          {
            type: 'layer-boundary',
            source: 'libs/orders/ui',
            target: 'libs/orders/data-access',
            severity: 'warning',
          },
          {
            type: 'ownership-presence',
            source: 'libs/shared/utils',
            severity: 'warning',
          },
        ],
        metadata: {
          worseningSignalCount: 2,
        },
      },
    };

    const result = summarizeArchitectureRecommendations(request);

    expect(result.kind).toBe('recommendations');
    expect(
      result.recommendations.some(
        (recommendation) =>
          recommendation.id === 'recommend-domain-contract-extraction'
      )
    ).toBe(true);
    expect(
      result.recommendations.some(
        (recommendation) =>
          recommendation.id === 'recommend-regression-burn-down'
      )
    ).toBe(true);
  });

  it('clusters prioritized smells and detects persistent smell signatures', () => {
    const request: AiAnalysisRequest = {
      kind: 'smell-clusters',
      generatedAt: '2026-03-13T12:00:00Z',
      profile: 'frontend-layered',
      inputs: {
        topViolations: [
          {
            type: 'domain-boundary',
            source: 'libs/orders/state',
            severity: 'error',
          },
          {
            type: 'domain-boundary',
            source: 'libs/orders/state',
            severity: 'error',
          },
          {
            type: 'layer-boundary',
            source: 'libs/orders/ui',
            severity: 'warning',
          },
        ],
        metadata: {
          persistentSmellSignals: [
            {
              type: 'domain-boundary',
              source: 'libs/orders/state',
              count: 3,
            },
          ],
        },
      },
    };

    const result = summarizeSmellClusters(request);

    expect(result.kind).toBe('smell-clusters');
    expect(
      result.findings.some(
        (finding) => finding.id === 'smell-cluster-persistence'
      )
    ).toBe(true);
    expect(
      result.recommendations.some(
        (recommendation) =>
          recommendation.id === 'smell-cluster-domain-remediation-sprint'
      )
    ).toBe(true);
    expect(
      result.recommendations.some(
        (recommendation) =>
          recommendation.id === 'smell-cluster-persistent-backlog'
      )
    ).toBe(true);
  });

  it('builds deterministic refactoring suggestions from hotspots, fanout, and persistence', () => {
    const request: AiAnalysisRequest = {
      kind: 'refactoring-suggestions',
      generatedAt: '2026-03-13T12:00:00Z',
      profile: 'frontend-layered',
      inputs: {
        topViolations: [
          {
            type: 'domain-boundary',
            source: 'libs/orders/state',
            severity: 'error',
          },
          {
            type: 'layer-boundary',
            source: 'libs/orders/ui',
            severity: 'warning',
          },
        ],
        metadata: {
          hotspotProjects: [
            {
              project: 'libs/orders/state',
              count: 2,
            },
          ],
          highFanoutProjects: [
            {
              project: 'libs/shared/utils',
              count: 9,
            },
          ],
          persistentSmellSignals: [
            {
              type: 'domain-boundary',
              source: 'libs/orders/state',
              count: 3,
            },
          ],
        },
      },
    };

    const result = summarizeRefactoringSuggestions(request);

    expect(result.kind).toBe('refactoring-suggestions');
    expect(
      result.recommendations.some(
        (recommendation) => recommendation.id === 'refactor-hotspot-seams'
      )
    ).toBe(true);
    expect(
      result.recommendations.some(
        (recommendation) =>
          recommendation.id === 'refactor-domain-anti-corruption-layer'
      )
    ).toBe(true);
    expect(
      result.recommendations.some(
        (recommendation) => recommendation.id === 'refactor-reduce-fanout'
      )
    ).toBe(true);
    expect(
      result.recommendations.some(
        (recommendation) =>
          recommendation.id === 'refactor-persistent-debt-program'
      )
    ).toBe(true);
  });

  it('builds deterministic scorecard findings and trend-aware recommendations', () => {
    const request: AiAnalysisRequest = {
      kind: 'scorecard',
      generatedAt: '2026-03-13T12:00:00Z',
      profile: 'frontend-layered',
      inputs: {
        snapshot: {
          timestamp: '2026-03-13T12:00:00Z',
          repo: 'anarchitecture-plugins',
          branch: 'main',
          commitSha: 'abc1234',
          pluginVersion: '0.1.0',
          metricSchemaVersion: '1.0',
          metrics: {
            'architectural-entropy': 0.3,
          },
          scores: {
            workspaceHealth: 68,
          },
          violations: [
            {
              type: 'domain-boundary',
              source: 'libs/orders/state',
              severity: 'error',
            },
            {
              type: 'domain-boundary',
              source: 'libs/orders/ui',
              severity: 'warning',
            },
          ],
        },
        comparison: {
          baseline: {
            timestamp: '2026-03-01T12:00:00Z',
            repo: 'anarchitecture-plugins',
            branch: 'main',
            commitSha: 'aaa1111',
            pluginVersion: '0.1.0',
            metricSchemaVersion: '1.0',
            metrics: {
              'architectural-entropy': 0.2,
            },
            scores: {
              workspaceHealth: 72,
            },
            violations: [],
          },
          current: {
            timestamp: '2026-03-13T12:00:00Z',
            repo: 'anarchitecture-plugins',
            branch: 'main',
            commitSha: 'abc1234',
            pluginVersion: '0.1.0',
            metricSchemaVersion: '1.0',
            metrics: {
              'architectural-entropy': 0.3,
            },
            scores: {
              workspaceHealth: 68,
            },
            violations: [
              {
                type: 'domain-boundary',
                source: 'libs/orders/state',
                severity: 'error',
              },
            ],
          },
          metricDeltas: [
            {
              id: 'architectural-entropy',
              baseline: 0.2,
              current: 0.3,
              delta: 0.1,
            },
          ],
          scoreDeltas: [
            {
              id: 'workspaceHealth',
              baseline: 72,
              current: 68,
              delta: -4,
            },
          ],
          newViolations: [
            {
              type: 'domain-boundary',
              source: 'libs/orders/state',
              severity: 'error',
            },
          ],
          resolvedViolations: [],
        },
      },
    };

    const result = summarizeScorecard(request);

    expect(result.kind).toBe('scorecard');
    expect(result.summary).toContain('(Critical, D)');
    expect(result.findings[0]?.detail).toContain('(Critical, grade D)');
    expect(result.metadata?.workspaceHealthStatus).toBe('critical');
    expect(result.metadata?.trend).toBe('worsening');
    expect(
      result.recommendations.some(
        (recommendation) => recommendation.id === 'scorecard-stop-regression'
      )
    ).toBe(true);
  });

  it('builds deterministic onboarding findings from inventory and hotspot signals', () => {
    const request: AiAnalysisRequest = {
      kind: 'onboarding',
      generatedAt: '2026-03-14T12:00:00Z',
      profile: 'frontend-layered',
      inputs: {
        topViolations: [
          {
            type: 'domain-boundary',
            source: 'libs/orders/state',
            severity: 'error',
          },
          {
            type: 'layer-boundary',
            source: 'libs/orders/ui',
            severity: 'warning',
          },
        ],
        metadata: {
          projectCount: 24,
          dependencyCount: 72,
          ownershipCoverage: 0.92,
          domainSummary: [
            {
              domain: 'orders',
              count: 8,
            },
            {
              domain: 'shared',
              count: 6,
            },
          ],
          layerSummary: [
            {
              layer: 'feature',
              count: 10,
            },
            {
              layer: 'data-access',
              count: 7,
            },
          ],
          topFanoutProjects: [
            {
              project: 'libs/shared/utils',
              count: 9,
            },
          ],
        },
      },
    };

    const result = summarizeOnboarding(request);

    expect(result.kind).toBe('onboarding');
    expect(
      result.findings.some((finding) => finding.id === 'onboarding-repo-shape')
    ).toBe(true);
    expect(
      result.recommendations.some(
        (recommendation) =>
          recommendation.id === 'onboarding-trace-fanout-hotspots'
      )
    ).toBe(true);
    expect(
      result.recommendations.some(
        (recommendation) =>
          recommendation.id === 'onboarding-review-governance-hotspots'
      )
    ).toBe(true);
  });
});

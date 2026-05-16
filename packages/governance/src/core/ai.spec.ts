import {
  buildAiManagementInsightsHandoffPayload,
  buildAiDriftHandoffPayload,
  buildAiPrImpactHandoffPayload,
  buildAiRootCauseHandoffPayload,
  type AiAnalysisRequest,
  type AiAnalysisResult,
} from './index.js';
import { buildGovernanceAssessment } from './assessment.js';
import { coreTestWorkspace } from './testing/workspace.fixtures.js';

describe('core ai handoff payload builders', () => {
  it('builds a deterministic root-cause payload from plain core data without writing files', () => {
    const assessment = buildGovernanceAssessment({
      workspace: coreTestWorkspace,
      profile: 'frontend-layered',
      warnings: [],
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
      violations: [],
      signals: [],
      measurements: [],
      health: {
        score: 100,
        status: 'good',
        grade: 'A',
        hotspots: [],
        metricHotspots: [],
        projectHotspots: [],
        explainability: {
          summary: 'Healthy.',
          statusReason: 'Score meets good threshold.',
          weakestMetrics: [],
          dominantIssues: [],
        },
      },
      recommendations: [],
    });

    const request: AiAnalysisRequest = {
      kind: 'root-cause',
      generatedAt: '2026-05-13T10:00:00.000Z',
      profile: assessment.profile,
      inputs: {
        snapshot: {
          timestamp: '2026-05-13T10:00:00.000Z',
          repo: 'test-repo',
          branch: 'main',
          commitSha: 'abc123',
          pluginVersion: '0.1.0',
          metricSchemaVersion: '1.1',
          metrics: {},
          scores: { workspaceHealth: 100 },
          violations: [],
        },
        dependencies: assessment.workspace.dependencies,
        topViolations: [],
        metadata: {
          snapshotPath: '.governance-metrics/snapshots/example.json',
        },
      },
    };
    const analysis: AiAnalysisResult = {
      kind: 'root-cause',
      summary: 'No prioritized governance violations found.',
      findings: [],
      recommendations: [],
    };

    const payload = buildAiRootCauseHandoffPayload({
      request,
      analysis,
      payloadScope: {
        dependencies: {
          total: assessment.workspace.dependencies.length,
          included: assessment.workspace.dependencies.length,
          limit: 120,
          truncated: false,
        },
      },
      metadata: {
        snapshotPath: '.governance-metrics/snapshots/example.json',
      },
    });

    expect(payload).toEqual({
      useCase: 'root-cause',
      request,
      analysis,
      payloadScope: {
        dependencies: {
          total: assessment.workspace.dependencies.length,
          included: assessment.workspace.dependencies.length,
          limit: 120,
          truncated: false,
        },
      },
      metadata: {
        snapshotPath: '.governance-metrics/snapshots/example.json',
      },
    });
  });

  it('builds a deterministic drift payload from plain snapshot comparison data', () => {
    const request = {
      kind: 'drift',
      generatedAt: '2026-05-13T10:00:00.000Z',
      profile: 'frontend-layered',
      inputs: {
        comparison: {
          baseline: {
            timestamp: '2026-05-01T10:00:00.000Z',
            branch: 'main',
            commitSha: 'abc123',
          },
          current: {
            timestamp: '2026-05-13T10:00:00.000Z',
            branch: 'main',
            commitSha: 'def456',
          },
          metricDeltas: [],
          scoreDeltas: [],
          newViolations: [],
          resolvedViolations: [],
        },
        metadata: {
          snapshotCount: 2,
        },
      },
    };
    const analysis: AiAnalysisResult = {
      kind: 'drift',
      summary: 'Stable trend.',
      findings: [],
      recommendations: [],
    };

    const payload = buildAiDriftHandoffPayload({
      request,
      analysis,
      payloadScope: {
        signals: {
          total: 0,
          included: 0,
          limit: 12,
          truncated: false,
        },
      },
    });

    expect(payload).toEqual({
      useCase: 'drift',
      request,
      analysis,
      payloadScope: {
        signals: {
          total: 0,
          included: 0,
          limit: 12,
          truncated: false,
        },
      },
    });
  });

  it('preserves baseRef and headRef semantics in pr-impact payloads', () => {
    const request: AiAnalysisRequest = {
      kind: 'pr-impact',
      generatedAt: '2026-05-13T10:00:00.000Z',
      profile: 'frontend-layered',
      inputs: {
        affectedProjects: ['platform-shell'],
        dependencies: coreTestWorkspace.dependencies,
        metadata: {
          baseRef: 'main',
          headRef: 'feature/branch',
          changedFilesCount: 3,
        },
      },
    };
    const analysis: AiAnalysisResult = {
      kind: 'pr-impact',
      summary: 'Medium impact.',
      findings: [],
      recommendations: [],
    };

    const payload = buildAiPrImpactHandoffPayload({
      request,
      analysis,
      payloadScope: {
        dependencies: {
          total: coreTestWorkspace.dependencies.length,
          included: coreTestWorkspace.dependencies.length,
          limit: 120,
          truncated: false,
        },
      },
    });

    expect(payload.request.inputs.metadata).toMatchObject({
      baseRef: 'main',
      headRef: 'feature/branch',
    });
    expect(payload.useCase).toBe('pr-impact');
  });

  it('returns identical payloads for identical input', () => {
    const request: AiAnalysisRequest = {
      kind: 'pr-impact',
      generatedAt: '2026-05-13T10:00:00.000Z',
      profile: 'frontend-layered',
      inputs: {
        affectedProjects: ['platform-shell'],
        dependencies: coreTestWorkspace.dependencies,
        metadata: {
          baseRef: 'main',
          headRef: 'feature/branch',
          changedFilesCount: 3,
        },
      },
    };
    const analysis: AiAnalysisResult = {
      kind: 'pr-impact',
      summary: 'Medium impact.',
      findings: [],
      recommendations: [],
    };

    const first = buildAiPrImpactHandoffPayload({
      request,
      analysis,
      payloadScope: {
        dependencies: {
          total: coreTestWorkspace.dependencies.length,
          included: coreTestWorkspace.dependencies.length,
          limit: 120,
          truncated: false,
        },
      },
    });
    const second = buildAiPrImpactHandoffPayload({
      request,
      analysis,
      payloadScope: {
        dependencies: {
          total: coreTestWorkspace.dependencies.length,
          included: coreTestWorkspace.dependencies.length,
          limit: 120,
          truncated: false,
        },
      },
    });

    expect(second).toEqual(first);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it('supports management-insights as a deterministic AI handoff use case', () => {
    const request: AiAnalysisRequest = {
      kind: 'management-insights',
      generatedAt: '2026-05-16T10:00:00.000Z',
      profile: 'frontend-layered',
      inputs: {
        metadata: {
          deliveryImpact: {
            indices: [{ id: 'cost-of-change', score: 61, risk: 'medium' }],
          },
        },
      },
    };
    const analysis: AiAnalysisResult = {
      kind: 'management-insights',
      summary: 'Prepared management-insights handoff.',
      findings: [],
      recommendations: [],
    };

    const payload = buildAiManagementInsightsHandoffPayload({
      request,
      analysis,
      metadata: {
        profile: 'frontend-layered',
      },
    });

    expect(payload).toEqual({
      useCase: 'management-insights',
      request,
      analysis,
      metadata: {
        profile: 'frontend-layered',
      },
    });
  });
});

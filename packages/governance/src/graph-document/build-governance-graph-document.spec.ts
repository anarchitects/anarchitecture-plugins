import type {
  GovernanceAssessment,
  GovernanceProject,
  HealthScore,
  Measurement,
  Recommendation,
  SignalBreakdown,
  MetricBreakdown,
  GovernanceTopIssue,
  Violation,
} from '../core/index.js';
import type { GovernanceSignal } from '../signal-engine/index.js';
import {
  GOVERNANCE_GRAPH_DOCUMENT_SCHEMA_VERSION,
  buildGovernanceGraphDocument,
} from './index.js';

describe('buildGovernanceGraphDocument', () => {
  it('builds a deterministic empty document from minimal assessment input', () => {
    const document = buildGovernanceGraphDocument({
      assessment: createAssessment(),
      signals: [],
    });

    expect(document).toEqual({
      schemaVersion: GOVERNANCE_GRAPH_DOCUMENT_SCHEMA_VERSION,
      workspace: {
        id: 'workspace',
        name: 'workspace',
        root: '.',
        profile: 'frontend-layered',
      },
      summary: {
        nodeCount: 0,
        edgeCount: 0,
        findingCount: 0,
        healthyNodeCount: 0,
        warningNodeCount: 0,
        criticalNodeCount: 0,
        unknownNodeCount: 0,
        healthyEdgeCount: 0,
        warningEdgeCount: 0,
        criticalEdgeCount: 0,
        unknownEdgeCount: 0,
      },
      nodes: [],
      edges: [],
      facets: {
        health: [],
        tags: [],
        owners: [],
        findingSources: [],
        findingSeverities: [],
        ruleIds: [],
      },
    });
  });

  it('builds deterministic nodes, edges, findings, summary, and facets', () => {
    const assessment = createAssessment({
      workspaceProjects: [
        createProject({
          id: 'shared-util',
          type: 'library',
          tags: ['layer:shared', 'domain:shared'],
          owner: '@org/platform',
          metadata: {
            criticality: 'high',
            documented: true,
            nullable: null,
            nested: { ignored: true },
          },
        }),
        createProject({
          id: 'payments-app',
          type: 'application',
          tags: ['layer:app', 'domain:payments'],
          owner: '@org/payments',
        }),
        createProject({
          id: 'orders-app',
          type: 'application',
          tags: ['layer:app', 'domain:orders'],
          owner: '@org/orders',
          metadata: {
            score: 10,
          },
        }),
      ],
      dependencies: [
        {
          source: 'payments-app',
          target: 'shared-util',
          type: 'dynamic',
        },
        {
          source: 'orders-app',
          target: 'shared-util',
          type: 'static',
        },
      ],
      violations: [
        {
          id: 'violation-docs',
          ruleId: 'docs-stale',
          project: 'shared-util',
          severity: 'warning',
          category: 'documentation',
          message: 'Shared util docs are stale.',
          sourcePluginId: 'plugin-docs',
        },
        {
          id: 'violation-dup',
          ruleId: 'domain-boundary',
          project: 'orders-app',
          severity: 'error',
          category: 'boundary',
          message: 'Orders cannot depend on shared util.',
          details: {
            targetProject: 'shared-util',
          },
        },
      ],
    });
    const signals = createSignals();

    const document = buildGovernanceGraphDocument({
      assessment,
      signals,
      generatedAt: '2026-05-02T10:00:00.000Z',
    });

    expect(document.nodes).toEqual([
      {
        id: 'orders-app',
        label: 'orders-app',
        type: 'application',
        tags: ['domain:orders', 'layer:app'],
        owner: '@org/orders',
        score: 70,
        badges: [
          {
            id: 'ownership:present',
            label: 'Owner',
            kind: 'ownership',
            status: 'healthy',
            message: 'Owner metadata is present (@org/orders).',
          },
          {
            id: 'documentation:missing',
            label: 'Missing docs',
            kind: 'documentation',
            status: 'warning',
            message: 'Documentation metadata is missing or incomplete.',
          },
        ],
        metadata: {
          score: 10,
        },
        health: 'warning',
        findings: [],
      },
      {
        id: 'payments-app',
        label: 'payments-app',
        type: 'application',
        tags: ['domain:payments', 'layer:app'],
        owner: '@org/payments',
        score: 70,
        badges: [
          {
            id: 'ownership:present',
            label: 'Owner',
            kind: 'ownership',
            status: 'healthy',
            message: 'Owner metadata is present (@org/payments).',
          },
          {
            id: 'documentation:missing',
            label: 'Missing docs',
            kind: 'documentation',
            status: 'warning',
            message: 'Documentation metadata is missing or incomplete.',
          },
        ],
        health: 'warning',
        findings: [],
      },
      {
        id: 'shared-util',
        label: 'shared-util',
        type: 'library',
        tags: ['domain:shared', 'layer:shared'],
        owner: '@org/platform',
        score: 70,
        badges: [
          {
            id: 'ownership:present',
            label: 'Owner',
            kind: 'ownership',
            status: 'healthy',
            message: 'Owner metadata is present (@org/platform).',
          },
          {
            id: 'documentation:missing',
            label: 'Missing docs',
            kind: 'documentation',
            status: 'warning',
            message: 'Documentation metadata is missing or incomplete.',
          },
        ],
        metadata: {
          criticality: 'high',
          documented: true,
          nullable: null,
        },
        health: 'warning',
        findings: [
          {
            id: 'signal-missing-domain',
            source: 'signal',
            severity: 'warning',
            message: 'Shared util is missing domain context.',
            projectId: 'shared-util',
            category: 'boundary',
            type: 'missing-domain-context',
          },
          {
            id: 'violation-docs',
            source: 'extension',
            severity: 'warning',
            message: 'Shared util docs are stale.',
            ruleId: 'docs-stale',
            projectId: 'shared-util',
            category: 'documentation',
            sourcePluginId: 'plugin-docs',
          },
          {
            id: 'signal-ownership',
            source: 'extension',
            severity: 'info',
            message: 'Ownership coverage signal.',
            projectId: 'shared-util',
            category: 'ownership',
            type: 'ownership-gap',
            sourcePluginId: 'plugin-ownership',
          },
        ],
      },
    ]);

    expect(document.edges).toEqual([
      {
        id: 'orders-app->shared-util->static',
        source: 'orders-app',
        target: 'shared-util',
        type: 'static',
        score: 40,
        health: 'critical',
        findings: [
          {
            id: 'signal-policy',
            source: 'policy',
            severity: 'error',
            message: 'Orders cannot depend on shared util.',
            ruleId: 'domain-boundary',
            projectId: 'orders-app',
            targetProjectId: 'shared-util',
            category: 'boundary',
            type: 'domain-boundary-violation',
          },
          {
            id: 'signal-conformance',
            source: 'conformance',
            severity: 'error',
            message: 'Orders cannot depend on shared util.',
            ruleId: '@nx/conformance/enforce-project-boundaries',
            projectId: 'orders-app',
            targetProjectId: 'shared-util',
            category: 'dependency',
            type: 'conformance-violation',
          },
        ],
      },
      {
        id: 'payments-app->shared-util->dynamic',
        source: 'payments-app',
        target: 'shared-util',
        type: 'dynamic',
        score: 100,
        health: 'healthy',
        findings: [
          {
            id: 'signal-structural',
            source: 'signal',
            severity: 'info',
            message: 'Dependency: payments-app -> shared-util.',
            projectId: 'payments-app',
            targetProjectId: 'shared-util',
            category: 'dependency',
            type: 'structural-dependency',
          },
        ],
      },
    ]);

    expect(document.summary).toEqual({
      nodeCount: 3,
      edgeCount: 2,
      findingCount: 6,
      healthyNodeCount: 0,
      warningNodeCount: 3,
      criticalNodeCount: 0,
      unknownNodeCount: 0,
      healthyEdgeCount: 1,
      warningEdgeCount: 0,
      criticalEdgeCount: 1,
      unknownEdgeCount: 0,
    });
    expect(document.facets).toEqual({
      health: ['critical', 'warning', 'healthy'],
      tags: [
        'domain:orders',
        'domain:payments',
        'domain:shared',
        'layer:app',
        'layer:shared',
      ],
      owners: ['@org/orders', '@org/payments', '@org/platform'],
      findingSources: ['policy', 'conformance', 'signal', 'extension'],
      findingSeverities: ['error', 'warning', 'info'],
      ruleIds: [
        '@nx/conformance/enforce-project-boundaries',
        'docs-stale',
        'domain-boundary',
      ],
    });
    expect(document.generatedAt).toBe('2026-05-02T10:00:00.000Z');
  });

  it('produces equal output for equivalent unordered input', () => {
    const baseAssessment = createAssessment({
      workspaceProjects: [
        createProject({
          id: 'b-app',
          tags: ['layer:app', 'domain:b'],
        }),
        createProject({
          id: 'a-lib',
          type: 'library',
          tags: ['layer:shared', 'domain:a'],
        }),
      ],
      dependencies: [
        {
          source: 'b-app',
          target: 'a-lib',
          type: 'static',
        },
      ],
      violations: [
        {
          id: 'violation-a',
          ruleId: 'docs-stale',
          project: 'a-lib',
          severity: 'warning',
          category: 'documentation',
          message: 'Docs are stale.',
        },
      ],
    });

    const reorderedAssessment = createAssessment({
      workspaceProjects: [...baseAssessment.workspace.projects].reverse(),
      dependencies: [...baseAssessment.workspace.dependencies].reverse(),
      violations: [...baseAssessment.violations].reverse(),
    });
    const baseSignals = [
      {
        id: 'signal-b',
        source: 'graph',
        type: 'structural-dependency',
        sourceProjectId: 'b-app',
        targetProjectId: 'a-lib',
        relatedProjectIds: ['a-lib', 'b-app'],
        severity: 'info',
        category: 'dependency',
        message: 'Dependency: b-app -> a-lib.',
        createdAt: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'signal-a',
        source: 'graph',
        type: 'missing-domain-context',
        sourceProjectId: 'a-lib',
        relatedProjectIds: ['a-lib'],
        severity: 'warning',
        category: 'boundary',
        message: 'Missing domain context for a-lib.',
        createdAt: '2026-05-01T00:00:00.000Z',
      },
    ] satisfies GovernanceSignal[];

    const left = buildGovernanceGraphDocument({
      assessment: baseAssessment,
      signals: baseSignals,
      generatedAt: '2026-05-02T00:00:00.000Z',
    });
    const right = buildGovernanceGraphDocument({
      assessment: reorderedAssessment,
      signals: [...baseSignals].reverse(),
      generatedAt: '2026-05-02T00:00:00.000Z',
    });

    expect(left).toEqual(right);
  });
});

function createAssessment(
  input: {
    workspaceProjects?: GovernanceProject[];
    dependencies?: GovernanceAssessment['workspace']['dependencies'];
    violations?: Violation[];
  } = {}
): GovernanceAssessment {
  return {
    workspace: {
      id: 'workspace',
      name: 'workspace',
      root: '.',
      projects: input.workspaceProjects ?? [],
      dependencies: input.dependencies ?? [],
    },
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
    violations: input.violations ?? [],
    measurements: [
      {
        id: 'ownership-coverage',
        name: 'Ownership Coverage',
        family: 'ownership',
        value: 1,
        score: 100,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'documentation-completeness',
        name: 'Documentation Completeness',
        family: 'documentation',
        value: 1,
        score: 100,
        maxScore: 100,
        unit: 'ratio',
      },
    ] satisfies Measurement[],
    signalBreakdown: {
      total: 0,
      bySource: [],
      byType: [],
      bySeverity: [],
    } satisfies SignalBreakdown,
    metricBreakdown: {
      families: [],
    } satisfies MetricBreakdown,
    topIssues: [] satisfies GovernanceTopIssue[],
    health: createHealthScore(),
    recommendations: [] satisfies Recommendation[],
  };
}

function createProject(input: {
  id: string;
  type?: GovernanceProject['type'];
  tags?: string[];
  owner?: string;
  metadata?: Record<string, unknown>;
}): GovernanceProject {
  return {
    id: input.id,
    name: input.id,
    root: `packages/${input.id}`,
    type: input.type ?? 'application',
    tags: input.tags ?? [],
    ownership: input.owner
      ? {
          team: input.owner,
          source: 'project-metadata',
        }
      : undefined,
    metadata: input.metadata ?? {},
  };
}

function createSignals(): GovernanceSignal[] {
  return [
    {
      id: 'signal-policy',
      source: 'policy',
      type: 'domain-boundary-violation',
      sourceProjectId: 'orders-app',
      targetProjectId: 'shared-util',
      relatedProjectIds: ['shared-util', 'orders-app'],
      severity: 'error',
      category: 'boundary',
      message: 'Orders cannot depend on shared util.',
      metadata: {
        ruleId: 'domain-boundary',
      },
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'signal-ownership',
      source: 'extension',
      type: 'ownership-gap',
      sourceProjectId: 'shared-util',
      relatedProjectIds: ['shared-util'],
      severity: 'info',
      category: 'ownership',
      message: 'Ownership coverage signal.',
      sourcePluginId: 'plugin-ownership',
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'signal-structural',
      source: 'graph',
      type: 'structural-dependency',
      sourceProjectId: 'payments-app',
      targetProjectId: 'shared-util',
      relatedProjectIds: ['shared-util', 'payments-app'],
      severity: 'info',
      category: 'dependency',
      message: 'Dependency: payments-app -> shared-util.',
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'signal-conformance',
      source: 'conformance',
      type: 'conformance-violation',
      sourceProjectId: 'orders-app',
      targetProjectId: 'shared-util',
      relatedProjectIds: ['shared-util'],
      severity: 'error',
      category: 'dependency',
      message: 'Orders cannot depend on shared util.',
      metadata: {
        ruleId: '@nx/conformance/enforce-project-boundaries',
      },
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'signal-missing-domain',
      source: 'graph',
      type: 'missing-domain-context',
      sourceProjectId: 'shared-util',
      relatedProjectIds: ['shared-util'],
      severity: 'warning',
      category: 'boundary',
      message: 'Shared util is missing domain context.',
      createdAt: '2026-05-01T00:00:00.000Z',
    },
  ];
}

function createHealthScore(): HealthScore {
  return {
    score: 100,
    status: 'good',
    grade: 'A',
    hotspots: [],
    metricHotspots: [],
    projectHotspots: [],
    explainability: {
      summary: 'Healthy workspace.',
      statusReason: 'No issues.',
      weakestMetrics: [],
      dominantIssues: [],
    },
  };
}

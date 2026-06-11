import type {
  GovernanceAssessment,
  GovernanceSignal,
  HealthScore,
  Measurement,
  Recommendation,
  SignalBreakdown,
  MetricBreakdown,
  GovernanceTopIssue,
  Violation,
} from '@anarchitects/governance-core';
import type { GovernanceAssessmentArtifacts } from '../plugin/build-assessment-artifacts.js';
import {
  GOVERNANCE_GRAPH_DOCUMENT_SCHEMA_VERSION,
  buildGovernanceGraphDocument,
} from './index.js';

interface TestProject {
  id: string;
  name: string;
  root: string;
  type: 'application' | 'library' | 'tool' | 'unknown';
  tags: string[];
  ownership?: {
    team?: string;
    source?: string;
  };
  metadata: Record<string, unknown>;
}

interface TestDependency {
  source: string;
  target: string;
  type: string;
  sourceFile?: string;
}

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
          subjectId: 'shared-util',
          severity: 'warning',
          category: 'documentation',
          message: 'Shared util docs are stale.',
          sourcePluginId: 'plugin-docs',
        },
        {
          id: 'violation-dup',
          ruleId: 'domain-boundary',
          subjectId: 'orders-app',
          severity: 'error',
          category: 'boundary',
          message: 'Orders cannot depend on shared util.',
          details: {
            targetProject: 'shared-util',
          },
          reference: {
            nodeId: 'orders-app',
            relatedNodeIds: ['orders-app', 'shared-util'],
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
        type: 'project',
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
          domain: 'orders',
          kind: 'project',
          layer: 'app',
          path: 'packages/orders-app',
          root: 'packages/orders-app',
          score: 10,
          sourceSystem: 'nx',
        },
        health: 'warning',
        findings: [],
      },
      {
        id: 'payments-app',
        label: 'payments-app',
        type: 'project',
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
        metadata: {
          domain: 'payments',
          kind: 'project',
          layer: 'app',
          path: 'packages/payments-app',
          root: 'packages/payments-app',
          sourceSystem: 'nx',
        },
        health: 'warning',
        findings: [],
      },
      {
        id: 'shared-util',
        label: 'shared-util',
        type: 'project',
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
          domain: 'shared',
          kind: 'project',
          layer: 'shared',
          nested: '{"ignored":true}',
          nullable: null,
          path: 'packages/shared-util',
          root: 'packages/shared-util',
          sourceSystem: 'nx',
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
          subjectId: 'a-lib',
          severity: 'warning',
          category: 'documentation',
          message: 'Docs are stale.',
        },
      ],
    });

    const reorderedAssessment = createAssessment({
      workspaceProjects: [...readWorkspaceProjects(baseAssessment)].reverse(),
      dependencies: [...readWorkspaceDependencies(baseAssessment)].reverse(),
      violations: [...baseAssessment.violations].reverse(),
    });
    const baseSignals = [
      {
        id: 'signal-b',
        source: 'graph',
        type: 'structural-dependency',
        nodeId: 'b-app',
        relatedNodeIds: ['a-lib', 'b-app'],
        severity: 'info',
        category: 'dependency',
        message: 'Dependency: b-app -> a-lib.',
        createdAt: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'signal-a',
        source: 'graph',
        type: 'missing-domain-context',
        nodeId: 'a-lib',
        relatedNodeIds: ['a-lib'],
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

  it('builds graph nodes and edges from canonical artifacts with legacy workspace fallback preserved', () => {
    const assessment = createAssessment({
      workspaceProjects: [
        createProject({
          id: 'legacy-only',
          type: 'library',
          tags: ['domain:legacy'],
        }),
      ],
      dependencies: [
        {
          source: 'legacy-only',
          target: 'legacy-only',
          type: 'implicit',
        },
      ],
    });
    const artifacts = createArtifactsWithCanonicalGraph(assessment);

    const document = buildGovernanceGraphDocument({
      assessment,
      artifacts,
      signals: [
        {
          id: 'signal-policy',
          source: 'policy',
          type: 'domain-boundary-violation',
          nodeId: 'orders-app',
          relatedNodeIds: ['orders-app', 'shared-util'],
          severity: 'error',
          category: 'boundary',
          message: 'Orders cannot depend on shared util.',
          metadata: {
            ruleId: 'domain-boundary',
          },
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    });

    expect(document.nodes.map((node) => node.id)).toEqual([
      'orders-app',
      'shared-util',
    ]);
    expect(document.edges).toEqual([
      expect.objectContaining({
        id: 'orders-app->shared-util->static',
        source: 'orders-app',
        target: 'shared-util',
        type: 'static',
        health: 'critical',
        findings: [
          expect.objectContaining({
            id: 'signal-policy',
            source: 'policy',
            ruleId: 'domain-boundary',
          }),
        ],
      }),
    ]);
    expect(document.nodes[0]).toMatchObject({
      id: 'orders-app',
      label: 'Orders App',
      type: 'application',
      tags: ['domain:orders', 'layer:app'],
      owner: '@org/orders',
      metadata: {
        domain: 'orders',
        kind: 'project',
        layer: 'app',
        nx: '{"projectType":"application","targets":["build","test"]}',
        path: 'apps/orders',
        root: 'apps/orders',
        sourceSystem: 'nx',
      },
    });
    expect(document.summary).toMatchObject({
      nodeCount: 2,
      edgeCount: 1,
      findingCount: 1,
    });
  });
});

function createAssessment(
  input: {
    workspaceProjects?: TestProject[];
    dependencies?: TestDependency[];
    violations?: Violation[];
  } = {}
): GovernanceAssessment {
  const workspaceProjects = input.workspaceProjects ?? [];
  const dependencies = input.dependencies ?? [];

  return {
    workspace: {
      id: 'workspace',
      name: 'workspace',
      root: '.',
      nodes: workspaceProjects.map((project) => ({
        id: project.id,
        name: project.name,
        kind: 'project',
        sourceSystem: 'nx',
        root: project.root,
        path: project.root,
        tags: project.tags,
        classification: {
          domain: readTagValue(project.tags, 'domain'),
          layer: readTagValue(project.tags, 'layer'),
          tags: project.tags,
        },
        ownership: project.ownership,
        metadata: project.metadata,
      })),
      relations: dependencies.map((dependency, index) => ({
        id: `${dependency.source}->${dependency.target}:${dependency.type}:${index}`,
        sourceNodeId: dependency.source,
        targetNodeId: dependency.target,
        kind: 'dependency',
        metadata: {
          dependencyType: dependency.type,
          ...(dependency.sourceFile
            ? { sourceFile: dependency.sourceFile }
            : {}),
        },
      })),
    } as GovernanceAssessment['workspace'],
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

function readTagValue(tags: string[], prefix: string): string | undefined {
  const matchingTag = tags.find((tag) => tag.startsWith(`${prefix}:`));
  return matchingTag ? matchingTag.slice(prefix.length + 1) : undefined;
}

function createProject(input: {
  id: string;
  type?: TestProject['type'];
  tags?: string[];
  owner?: string;
  metadata?: Record<string, unknown>;
}): TestProject {
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
      nodeId: 'orders-app',
      relatedNodeIds: ['shared-util', 'orders-app'],
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
      nodeId: 'shared-util',
      relatedNodeIds: ['shared-util'],
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
      nodeId: 'payments-app',
      relatedNodeIds: ['shared-util', 'payments-app'],
      severity: 'info',
      category: 'dependency',
      message: 'Dependency: payments-app -> shared-util.',
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'signal-conformance',
      source: 'conformance',
      type: 'conformance-violation',
      nodeId: 'orders-app',
      relatedNodeIds: ['shared-util'],
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
      nodeId: 'shared-util',
      relatedNodeIds: ['shared-util'],
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
    subjectHotspots: [],
    explainability: {
      summary: 'Healthy workspace.',
      statusReason: 'No issues.',
      weakestMetrics: [],
      dominantIssues: [],
    },
  };
}

function readWorkspaceProjects(
  assessment: GovernanceAssessment
): TestProject[] {
  return assessment.workspace.nodes.map((node) => ({
    id: node.id,
    name: node.name ?? node.id,
    root: node.root ?? node.path ?? node.id,
    type:
      readTagValue(node.tags, 'layer') === 'shared' ? 'library' : 'application',
    tags: [...node.tags],
    ...(node.ownership ? { ownership: node.ownership } : {}),
    metadata: node.metadata,
  }));
}

function readWorkspaceDependencies(
  assessment: GovernanceAssessment
): TestDependency[] {
  return assessment.workspace.relations.map((dependency) => ({
    source: dependency.sourceNodeId,
    target: dependency.targetNodeId,
    type:
      (dependency.metadata?.['dependencyType'] as string | undefined) ??
      'unknown',
    sourceFile: dependency.metadata?.['sourceFile'] as string | undefined,
  }));
}

function createArtifactsWithCanonicalGraph(
  assessment: GovernanceAssessment
): GovernanceAssessmentArtifacts {
  const canonicalWorkspace = {
    ...(assessment.workspace as unknown as Record<string, unknown>),
    nodes: [
      {
        id: 'orders-app',
        name: 'Orders App',
        kind: 'project',
        sourceSystem: 'nx',
        root: 'apps/orders',
        path: 'apps/orders',
        tags: ['domain:orders', 'layer:app'],
        classification: {
          domain: 'orders',
          layer: 'app',
          tags: ['domain:orders', 'layer:app'],
        },
        ownership: {
          team: '@org/orders',
          source: 'project-metadata',
        },
        metadata: {
          nx: {
            projectType: 'application',
            targets: ['build', 'test'],
          },
        },
      },
      {
        id: 'shared-util',
        name: 'Shared Util',
        kind: 'project',
        sourceSystem: 'nx',
        root: 'libs/shared/util',
        path: 'libs/shared/util',
        tags: ['domain:shared', 'layer:util'],
      },
    ],
    relations: [
      {
        id: 'nx:orders-app->shared-util:static:0',
        sourceNodeId: 'orders-app',
        targetNodeId: 'shared-util',
        kind: 'dependency',
        metadata: {
          dependencyType: 'static',
          sourceFile: 'apps/orders/src/main.ts',
        },
      },
    ],
  } as unknown as GovernanceAssessment['workspace'];

  return {
    assessment: {
      ...assessment,
      workspace: canonicalWorkspace,
    },
    signals: [],
    exceptionApplication: {
      declaredExceptions: [],
      exceptionStatuses: {},
      policyViolations: [],
      conformanceFindings: [],
      activePolicyViolations: [],
      suppressedPolicyViolations: [],
      reactivatedPolicyViolations: [],
      activeConformanceFindings: [],
      suppressedConformanceFindings: [],
      reactivatedConformanceFindings: [],
    },
    extensionDiagnostics: [],
    adapterResult: {
      workspaceRoot: '.',
      nodes: [
        {
          id: 'orders-app',
          name: 'Orders App',
          kind: 'project',
          sourceSystem: 'nx',
          root: 'apps/orders',
          path: 'apps/orders',
          tags: ['domain:orders', 'layer:app'],
          classification: {
            domain: 'orders',
            layer: 'app',
            tags: ['domain:orders', 'layer:app'],
          },
          ownership: {
            team: '@org/orders',
            source: 'project-metadata',
          },
          metadata: {
            nx: {
              projectType: 'application',
              targets: ['build', 'test'],
            },
          },
        },
        {
          id: 'shared-util',
          name: 'Shared Util',
          kind: 'project',
          sourceSystem: 'nx',
          root: 'libs/shared/util',
          path: 'libs/shared/util',
          tags: ['domain:shared', 'layer:util'],
        },
      ],
      relations: [
        {
          id: 'nx:orders-app->shared-util:static:0',
          sourceNodeId: 'orders-app',
          targetNodeId: 'shared-util',
          kind: 'dependency',
          metadata: {
            dependencyType: 'static',
            sourceFile: 'apps/orders/src/main.ts',
          },
        },
      ],
    } as GovernanceAssessmentArtifacts['adapterResult'],
  };
}

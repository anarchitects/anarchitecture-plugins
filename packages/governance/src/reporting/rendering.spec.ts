import type { GovernanceAssessment } from '@anarchitects/governance-core';

import type { GovernanceAssessmentArtifacts } from '../plugin/build-assessment-artifacts.js';
import { renderCliReport } from './render-cli.js';
import { renderJsonReport } from './render-json.js';

describe('governance report rendering', () => {
  it('renders canonical workspace nodes and relations in CLI output', () => {
    const rendered = renderCliReport(makeAssessment());

    expect(rendered).toContain('Health Score: 80 (Warning, B)');
    expect(rendered).toContain('Nodes: 2');
    expect(rendered).toContain('Relations: 1');
    expect(rendered).not.toContain('Projects:');
    expect(rendered).not.toContain('Dependencies:');
    expect(rendered).toContain('Nodes:');
    expect(rendered).toContain(
      '- Orders App [orders-app] :: kind=project :: source=nx :: tech=typescript'
    );
    expect(rendered).toContain('class=domain=orders,layer=app,scope=public');
    expect(rendered).toContain('owner=@org/orders');
    expect(rendered).toContain(
      '- Shared Util [shared-util] :: kind=project :: source=nx'
    );
    expect(rendered).toContain('Relations:');
    expect(rendered).toContain(
      '- nx:orders-app->shared-util:static:apps/orders/src/main.ts :: Orders App [orders-app] -> Shared Util [shared-util] :: kind=dependency'
    );
    expect(rendered).toContain(
      'metadata=nx={dependencyType:static,sourceFile:apps/orders/src/main.ts}'
    );
  });

  it('renders canonical references for signals, violations, recommendations, and exception findings', () => {
    const rendered = renderCliReport(makeArtifacts());

    expect(rendered).toContain('Signals:');
    expect(rendered).toContain(
      '- [warning] ownership-gap (extension) :: scope=node=Orders App [orders-app] :: Ownership is missing.'
    );
    expect(rendered).toContain(
      '- [info] structural-dependency (extension) :: scope=relation=Orders App [orders-app] -> Shared Util [shared-util] [nx:orders-app->shared-util:static:apps/orders/src/main.ts] ; related nodes=Orders App [orders-app],Shared Util [shared-util] :: Dependency trace recorded.'
    );
    expect(rendered).toContain('Suppressed Findings:');
    expect(rendered).toContain(
      '- suppress-domain :: active :: policy/policy-violation :: [error] :: domain-boundary :: scope=relation=Orders App [orders-app] -> Shared Util [shared-util] [nx:orders-app->shared-util:static:apps/orders/src/main.ts] ; related nodes=Orders App [orders-app],Shared Util [shared-util] :: Suppressed domain boundary violation'
    );
    expect(rendered).toContain('Reactivated Findings:');
    expect(rendered).toContain(
      '- stale-owner-gap :: stale :: policy/policy-violation :: [warning] :: ownership-presence :: scope=node=Shared Util [shared-util] :: Reactivated ownership gap'
    );
    expect(rendered).toContain('Top Issues:');
    expect(rendered).toContain(
      '- [error] domain-boundary-violation (policy) x2 :: domain-boundary :: scope=relation=Orders App [orders-app] -> Shared Util [shared-util] [nx:orders-app->shared-util:static:apps/orders/src/main.ts] :: Domain boundary violation'
    );
    expect(rendered).toContain('Violation Details:');
    expect(rendered).toContain(
      '- [warning] ownership :: ownership-presence :: scope=node=Shared Util [shared-util] :: Ownership is missing.'
    );
    expect(rendered).toContain('Recommendations:');
    expect(rendered).toContain(
      '- (medium) Reduce dependency pressure :: scope=relation=Orders App [orders-app] -> Shared Util [shared-util] [nx:orders-app->shared-util:static:apps/orders/src/main.ts] - Dependency pressure is elevated.'
    );
  });

  it('renders canonical health subject hotspots', () => {
    const rendered = renderCliReport(makeAssessment());

    expect(rendered).toContain('Metric Hotspots:');
    expect(rendered).toContain('Subject Hotspots:');
    expect(rendered).toContain(
      '- Orders App [orders-app]: 2 :: type=node :: issues=domain-boundary-violation,ownership-gap'
    );
    expect(rendered).toContain(
      '- Orders App [orders-app] -> Shared Util [shared-util] [nx:orders-app->shared-util:static:apps/orders/src/main.ts]: 1 :: type=relation :: issues=structural-dependency'
    );
    expect(rendered).not.toContain('Project Hotspots:');
  });

  it('renders JSON from assessment workspace canonical graph rather than adapter fallback', () => {
    const json = JSON.parse(renderJsonReport(makeArtifacts())) as {
      workspace: Record<string, unknown>;
      nodes: Array<Record<string, unknown>>;
      relations: Array<Record<string, unknown>>;
      signals: Array<Record<string, unknown>>;
      diagnostics: Array<Record<string, unknown>>;
      extensionDiagnostics: Array<Record<string, unknown>>;
      capabilities: Array<Record<string, unknown>>;
    };

    expect(json.workspace).toMatchObject({
      id: 'workspace',
      name: 'workspace',
      root: '/workspace',
    });
    expect(json.workspace).toHaveProperty('nodes');
    expect(json.workspace).toHaveProperty('relations');
    expect(json.workspace).not.toHaveProperty('projects');
    expect(json.workspace).not.toHaveProperty('dependencies');

    expect(json.nodes).toEqual([
      expect.objectContaining({
        id: 'orders-app',
        name: 'Orders App',
        kind: 'project',
        sourceSystem: 'nx',
        technology: 'typescript',
      }),
      expect.objectContaining({
        id: 'shared-util',
        name: 'Shared Util',
        kind: 'project',
        sourceSystem: 'nx',
      }),
    ]);
    expect(json.nodes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'wrong-node',
        }),
      ])
    );

    expect(json.relations).toEqual([
      expect.objectContaining({
        id: 'nx:orders-app->shared-util:static:apps/orders/src/main.ts',
        sourceNodeId: 'orders-app',
        sourceNodeName: 'Orders App',
        targetNodeId: 'shared-util',
        targetNodeName: 'Shared Util',
        kind: 'dependency',
      }),
    ]);

    expect(json.signals).toEqual([
      expect.objectContaining({
        id: 'signal:ownership',
        nodeId: 'orders-app',
      }),
      expect.objectContaining({
        id: 'signal:dependency',
        relationId: 'nx:orders-app->shared-util:static:apps/orders/src/main.ts',
        relatedNodeIds: ['orders-app', 'shared-util'],
      }),
    ]);
    expect(json.capabilities).toEqual([
      {
        id: 'nx.project-graph',
        version: '1',
        data: {
          projectCount: 2,
        },
      },
    ]);
    expect(json.diagnostics).toEqual([
      {
        code: 'adapter.graph.warning',
        source: 'governance-adapter-nx',
        message: 'Adapter graph warning.',
      },
    ]);
    expect(json.extensionDiagnostics).toEqual([
      {
        code: 'governance.extension.loaded',
        severity: 'notice',
        message: 'Loaded extension.',
        extensionId: 'governance-extension-nx',
      },
    ]);
  });

  it('preserves canonical workspace graph in assessment-only JSON output', () => {
    const json = JSON.parse(renderJsonReport(makeAssessment())) as {
      workspace: Record<string, unknown>;
    };

    expect(json.workspace).toMatchObject({
      id: 'workspace',
      name: 'workspace',
      root: '/workspace',
      nodes: [
        expect.objectContaining({
          id: 'orders-app',
        }),
        expect.objectContaining({
          id: 'shared-util',
        }),
      ],
      relations: [
        expect.objectContaining({
          id: 'nx:orders-app->shared-util:static:apps/orders/src/main.ts',
        }),
      ],
    });
  });
});

function makeAssessment(): GovernanceAssessment {
  return {
    workspace:
      canonicalWorkspace() as unknown as GovernanceAssessment['workspace'],
    profile: 'frontend-layered',
    warnings: [],
    exceptions: {
      summary: {
        declaredCount: 3,
        matchedCount: 2,
        suppressedPolicyViolationCount: 1,
        suppressedConformanceFindingCount: 1,
        unusedExceptionCount: 1,
        activeExceptionCount: 1,
        staleExceptionCount: 1,
        expiredExceptionCount: 1,
        reactivatedPolicyViolationCount: 1,
        reactivatedConformanceFindingCount: 0,
      },
      used: [
        {
          id: 'suppress-domain',
          source: 'policy',
          status: 'active',
          reason: 'Known transition.',
          owner: '@org/architecture',
          review: {
            reviewBy: '2026-06-01',
          },
          matchCount: 2,
        },
        {
          id: 'stale-owner-gap',
          source: 'policy',
          status: 'stale',
          reason: 'Needs review.',
          owner: '@org/architecture',
          review: {
            reviewBy: '2026-04-01',
          },
          matchCount: 1,
        },
      ],
      unused: [
        {
          id: 'unused-owner-gap',
          source: 'conformance',
          status: 'expired',
          reason: 'Reserved but currently unmatched.',
          owner: '@org/architecture',
          review: {
            expiresAt: '2026-03-01',
          },
          matchCount: 0,
        },
      ],
      suppressedFindings: [
        {
          kind: 'policy-violation',
          exceptionId: 'suppress-domain',
          source: 'policy',
          status: 'active',
          ruleId: 'domain-boundary',
          category: 'boundary',
          severity: 'error',
          message: 'Suppressed domain boundary violation',
          reference: {
            relationId:
              'nx:orders-app->shared-util:static:apps/orders/src/main.ts',
            relatedNodeIds: ['orders-app', 'shared-util'],
          },
        },
      ] as unknown as GovernanceAssessment['exceptions']['suppressedFindings'],
      reactivatedFindings: [
        {
          kind: 'policy-violation',
          exceptionId: 'stale-owner-gap',
          source: 'policy',
          status: 'stale',
          ruleId: 'ownership-presence',
          category: 'ownership',
          severity: 'warning',
          message: 'Reactivated ownership gap',
          reference: {
            nodeId: 'shared-util',
          },
        },
      ] as unknown as GovernanceAssessment['exceptions']['reactivatedFindings'],
    },
    violations: [
      {
        id: 'violation:ownership',
        ruleId: 'ownership-presence',
        project: 'unused-compat-field',
        severity: 'warning',
        category: 'ownership',
        message: 'Ownership is missing.',
        reference: {
          nodeId: 'shared-util',
        },
      },
    ] as unknown as GovernanceAssessment['violations'],
    measurements: [
      {
        id: 'architectural-entropy',
        name: 'Architectural Entropy',
        family: 'architecture',
        value: 0.2,
        score: 80,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'documentation-completeness',
        name: 'Documentation Completeness',
        family: 'documentation',
        value: 0.33,
        score: 33,
        maxScore: 100,
        unit: 'ratio',
        metadata: {
          reference: {
            nodeId: 'orders-app',
          },
        },
      },
    ] as unknown as GovernanceAssessment['measurements'],
    signalBreakdown: {
      total: 2,
      bySource: [{ source: 'extension', count: 2 }],
      byType: [
        { type: 'ownership-gap', count: 1 },
        { type: 'structural-dependency', count: 1 },
      ],
      bySeverity: [
        { severity: 'info', count: 1 },
        { severity: 'warning', count: 1 },
      ],
    },
    metricBreakdown: {
      families: [
        {
          family: 'architecture',
          score: 80,
          measurements: [
            {
              id: 'architectural-entropy',
              name: 'Architectural Entropy',
              score: 80,
            },
          ],
        },
        {
          family: 'documentation',
          score: 33,
          measurements: [
            {
              id: 'documentation-completeness',
              name: 'Documentation Completeness',
              score: 33,
            },
          ],
        },
      ],
    },
    topIssues: [
      {
        type: 'domain-boundary-violation',
        source: 'policy',
        severity: 'error',
        count: 2,
        subjects: [],
        ruleId: 'domain-boundary',
        message: 'Domain boundary violation',
        reference: {
          relationId:
            'nx:orders-app->shared-util:static:apps/orders/src/main.ts',
        },
      },
    ] as unknown as GovernanceAssessment['topIssues'],
    health: {
      score: 80,
      status: 'warning',
      grade: 'B',
      hotspots: [
        {
          subjectId: 'orders-app',
          subjectType: 'node',
          count: 2,
          dominantIssueTypes: ['domain-boundary-violation', 'ownership-gap'],
        },
        {
          subjectId:
            'nx:orders-app->shared-util:static:apps/orders/src/main.ts',
          subjectType: 'relation',
          count: 1,
          dominantIssueTypes: ['structural-dependency'],
        },
      ] as unknown as GovernanceAssessment['health']['hotspots'],
      metricHotspots: [
        {
          id: 'documentation-completeness',
          name: 'Documentation Completeness',
          score: 33,
        },
      ],
      subjectHotspots: [],
      explainability: {
        summary:
          'Overall health is Warning at 80/100. Weakest metrics: Documentation Completeness (33), Architectural Entropy (80). Dominant issues: domain-boundary-violation x2, ownership-gap x1.',
        statusReason:
          'Score 80 is below the Good threshold (85) but meets the Warning threshold (70).',
        weakestMetrics: [
          {
            id: 'documentation-completeness',
            name: 'Documentation Completeness',
            score: 33,
          },
          {
            id: 'architectural-entropy',
            name: 'Architectural Entropy',
            score: 80,
          },
        ],
        dominantIssues: [
          {
            type: 'domain-boundary-violation',
            source: 'policy',
            severity: 'error',
            count: 2,
            subjects: [],
            ruleId: 'domain-boundary',
            message: 'Domain boundary violation',
          },
          {
            type: 'ownership-gap',
            source: 'policy',
            severity: 'warning',
            count: 1,
            subjects: [],
            ruleId: 'ownership-presence',
            message: 'Ownership gap',
          },
        ],
      },
    },
    recommendations: [
      {
        id: 'reduce-dependencies',
        title: 'Reduce dependency pressure',
        priority: 'medium',
        reason: 'Dependency pressure is elevated.',
        reference: {
          relationId:
            'nx:orders-app->shared-util:static:apps/orders/src/main.ts',
        },
      },
    ] as unknown as GovernanceAssessment['recommendations'],
  };
}

function makeArtifacts(): GovernanceAssessmentArtifacts {
  return {
    assessment: makeAssessment(),
    signals: [
      {
        id: 'signal:ownership',
        type: 'ownership-gap',
        severity: 'warning',
        category: 'ownership',
        message: 'Ownership is missing.',
        source: 'extension',
        nodeId: 'orders-app',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'signal:dependency',
        type: 'structural-dependency',
        severity: 'info',
        category: 'dependency',
        message: 'Dependency trace recorded.',
        source: 'extension',
        relationId: 'nx:orders-app->shared-util:static:apps/orders/src/main.ts',
        relatedNodeIds: ['orders-app', 'shared-util'],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ] as unknown as GovernanceAssessmentArtifacts['signals'],
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
    adapterResult: {
      workspaceRoot: '/workspace',
      nodes: [
        {
          id: 'wrong-node',
          name: 'Wrong Node',
        },
      ],
      relations: [
        {
          id: 'wrong-relation',
          sourceNodeId: 'wrong-node',
          targetNodeId: 'shared-util',
        },
      ],
    } as GovernanceAssessmentArtifacts['adapterResult'],
    capabilities: [
      {
        id: 'nx.project-graph',
        version: '1',
        data: {
          projectCount: 2,
        },
      },
    ],
    diagnostics: [
      {
        code: 'adapter.graph.warning',
        source: 'governance-adapter-nx',
        message: 'Adapter graph warning.',
      },
    ],
    extensionDiagnostics: [
      {
        code: 'governance.extension.loaded',
        severity: 'notice',
        message: 'Loaded extension.',
        extensionId: 'governance-extension-nx',
      },
    ],
  };
}

function canonicalWorkspace() {
  return {
    id: 'workspace',
    name: 'workspace',
    root: '/workspace',
    nodes: [
      {
        id: 'orders-app',
        name: 'Orders App',
        kind: 'project',
        sourceSystem: 'nx',
        technology: 'typescript',
        root: 'apps/orders',
        path: 'apps/orders',
        tags: ['domain:orders', 'layer:app'],
        classification: {
          domain: 'orders',
          layer: 'app',
          scope: 'public',
          tags: ['domain:orders', 'layer:app'],
        },
        ownership: {
          team: '@org/orders',
          contacts: ['orders@anarchitects.dev'],
          source: 'codeowners',
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
        classification: {
          domain: 'shared',
          layer: 'util',
          tags: ['domain:shared', 'layer:util'],
        },
        metadata: {
          nx: {
            projectType: 'library',
            targets: ['lint'],
          },
        },
      },
    ],
    relations: [
      {
        id: 'nx:orders-app->shared-util:static:apps/orders/src/main.ts',
        sourceNodeId: 'orders-app',
        targetNodeId: 'shared-util',
        kind: 'dependency',
        metadata: {
          nx: {
            dependencyType: 'static',
            sourceFile: 'apps/orders/src/main.ts',
          },
        },
        evidence: [
          {
            id: 'evidence:dependency',
            type: 'nx-dependency',
            reference: 'apps/orders/src/main.ts',
          },
        ],
      },
    ],
  };
}

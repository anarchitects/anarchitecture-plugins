import {
  GovernanceAssessment,
  GovernanceTopIssue,
} from '../core/index.js';
import type { GovernanceAssessmentArtifacts } from '../plugin/build-assessment-artifacts.js';
import type { GovernanceSignal } from '../signal-engine/index.js';
import { buildGovernanceGraphDocument } from './build-document.js';

describe('buildGovernanceGraphDocument', () => {
  it('builds a deterministic graph document with node, edge, finding, and filter data', () => {
    const assessment: GovernanceAssessment = {
      workspace: {
        id: 'workspace',
        name: 'workspace',
        root: '/workspace',
        projects: [
          {
            id: 'app',
            name: 'app',
            root: 'apps/app',
            type: 'application',
            tags: ['domain:billing', 'layer:feature'],
            domain: 'billing',
            layer: 'feature',
            ownership: {
              team: '@org/app-team',
              contacts: ['@org/app-team'],
              source: 'merged',
            },
            metadata: {
              documentation: true,
            },
          },
          {
            id: 'lib',
            name: 'lib',
            root: 'libs/lib',
            type: 'library',
            tags: ['domain:platform', 'layer:util'],
            domain: 'platform',
            layer: 'util',
            ownership: {
              source: 'none',
            },
            metadata: {},
          },
        ],
        dependencies: [
          {
            source: 'app',
            target: 'lib',
            type: 'static',
            sourceFile: 'apps/app/src/main.ts',
          },
        ],
      },
      profile: 'angular-cleanup',
      warnings: [],
      violations: [
        {
          id: 'app-lib-domain',
          ruleId: 'domain-boundary',
          project: 'app',
          severity: 'error',
          category: 'boundary',
          message: 'App crosses domains.',
          details: {
            targetProject: 'lib',
          },
        },
        {
          id: 'lib-ownership',
          ruleId: 'ownership-presence',
          project: 'lib',
          severity: 'warning',
          category: 'ownership',
          message: 'Lib has no owner.',
        },
      ],
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
      ],
      signalBreakdown: {
        total: 2,
        bySource: [{ source: 'policy', count: 1 }, { source: 'extension', count: 1 }],
        byType: [
          { type: 'domain-boundary-violation', count: 1 },
          { type: 'angular-facade-bypass', count: 1 },
        ],
        bySeverity: [
          { severity: 'error', count: 1 },
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
        ],
      },
      topIssues: [
        buildTopIssue({
          type: 'domain-boundary-violation',
          source: 'policy',
          severity: 'error',
          count: 1,
          projects: ['app', 'lib'],
          ruleId: 'domain-boundary',
          message: 'App crosses domains.',
        }),
      ],
      health: {
        score: 72,
        status: 'warning',
        grade: 'B',
        hotspots: ['Architectural Entropy'],
        metricHotspots: [
          {
            id: 'architectural-entropy',
            name: 'Architectural Entropy',
            score: 80,
          },
        ],
        projectHotspots: [
          {
            project: 'app',
            count: 2,
            dominantIssueTypes: [
              'domain-boundary-violation',
              'angular-facade-bypass',
            ],
          },
        ],
        explainability: {
          summary: 'Overall health is Warning at 72/100.',
          statusReason: 'Thresholds place the workspace in warning.',
          weakestMetrics: [
            {
              id: 'architectural-entropy',
              name: 'Architectural Entropy',
              score: 80,
            },
          ],
          dominantIssues: [
            buildTopIssue({
              type: 'domain-boundary-violation',
              source: 'policy',
              severity: 'error',
              count: 1,
              projects: ['app', 'lib'],
              ruleId: 'domain-boundary',
              message: 'App crosses domains.',
            }),
          ],
        },
      },
      recommendations: [],
    };

    const signals: GovernanceSignal[] = [
      {
        id: 'domain-signal',
        type: 'domain-boundary-violation',
        sourceProjectId: 'app',
        targetProjectId: 'lib',
        relatedProjectIds: ['app', 'lib'],
        severity: 'error',
        category: 'boundary',
        message: 'App crosses domains.',
        source: 'policy',
        createdAt: '2026-01-01T00:00:00.000Z',
        metadata: {
          ruleId: 'domain-boundary',
        },
      },
      {
        id: 'extension-signal',
        type: 'angular-facade-bypass',
        sourceProjectId: 'app',
        relatedProjectIds: ['app'],
        severity: 'warning',
        category: 'structure',
        message: 'Facade bypass detected.',
        source: 'extension',
        sourcePluginId: '@anarchitects/nx-governance-angular',
        createdAt: '2026-01-01T00:00:01.000Z',
      },
    ];

    const artifacts: GovernanceAssessmentArtifacts = {
      assessment,
      signals,
    };

    const first = buildGovernanceGraphDocument(artifacts);
    const second = buildGovernanceGraphDocument(artifacts);

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe('1.0');
    expect(first.summary.projectCount).toBe(2);
    expect(first.summary.dependencyCount).toBe(1);
    expect(first.summary.signalCount).toBe(2);
    expect(first.summary.violationCount).toBe(2);
    expect(first.summary.findingCount).toBe(4);

    expect(first.nodes).toEqual([
      expect.objectContaining({
        id: 'app',
        documentationPresent: true,
        dependencyCount: 1,
        dependentCount: 0,
        findingIds: [
          'violation:app-lib-domain',
          'signal:domain-signal',
          'signal:extension-signal',
        ],
      }),
      expect.objectContaining({
        id: 'lib',
        documentationPresent: false,
        dependencyCount: 0,
        dependentCount: 1,
        findingIds: ['signal:domain-signal', 'violation:lib-ownership'],
      }),
    ]);

    expect(first.edges).toEqual([
      expect.objectContaining({
        sourceProjectId: 'app',
        targetProjectId: 'lib',
        dependencyType: 'static',
        sourceFile: 'apps/app/src/main.ts',
        findingIds: ['violation:app-lib-domain', 'signal:domain-signal'],
      }),
    ]);

    expect(first.findings).toEqual([
      expect.objectContaining({
        id: 'violation:app-lib-domain',
        kind: 'violation',
        source: 'policy',
        sourceProjectId: 'app',
        targetProjectId: 'lib',
      }),
      expect.objectContaining({
        id: 'signal:domain-signal',
        kind: 'signal',
        source: 'policy',
        ruleId: 'domain-boundary',
      }),
      expect.objectContaining({
        id: 'signal:extension-signal',
        kind: 'signal',
        source: 'extension',
        sourcePluginId: '@anarchitects/nx-governance-angular',
      }),
      expect.objectContaining({
        id: 'violation:lib-ownership',
        kind: 'violation',
        source: 'policy',
        ruleId: 'ownership-presence',
      }),
    ]);

    expect(first.filters).toEqual({
      domains: [
        { value: 'billing', count: 1 },
        { value: 'platform', count: 1 },
      ],
      layers: [
        { value: 'feature', count: 1 },
        { value: 'util', count: 1 },
      ],
      projectTypes: [
        { value: 'application', count: 1 },
        { value: 'library', count: 1 },
      ],
      ownershipPresence: [
        { value: false, count: 1 },
        { value: true, count: 1 },
      ],
      documentationPresence: [
        { value: false, count: 1 },
        { value: true, count: 1 },
      ],
      findingSeverities: [
        { value: 'error', count: 2 },
        { value: 'warning', count: 2 },
      ],
      findingSources: [
        { value: 'extension', count: 1 },
        { value: 'policy', count: 3 },
      ],
      findingCategories: [
        { value: 'boundary', count: 2 },
        { value: 'ownership', count: 1 },
        { value: 'structure', count: 1 },
      ],
      findingTypes: [
        { value: 'angular-facade-bypass', count: 1 },
        { value: 'domain-boundary', count: 1 },
        { value: 'domain-boundary-violation', count: 1 },
        { value: 'ownership-presence', count: 1 },
      ],
      ruleIds: [
        { value: 'domain-boundary', count: 2 },
        { value: 'ownership-presence', count: 1 },
      ],
      sourcePluginIds: [
        { value: '@anarchitects/nx-governance-angular', count: 1 },
      ],
      metricFamilies: [{ value: 'architecture', count: 1 }],
    });

    expect(first.nodes[0]).not.toHaveProperty('status');
    expect(first.edges[0]).not.toHaveProperty('status');
  });
});

function buildTopIssue(
  issue: GovernanceTopIssue
): GovernanceTopIssue {
  return issue;
}

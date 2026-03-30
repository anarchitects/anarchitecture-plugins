import { GovernanceWorkspace, Violation } from '../core/index.js';
import { buildPolicySignals } from '../signal-engine/index.js';

import { calculateMetrics } from './calculate-metrics.js';

describe('calculateMetrics', () => {
  const workspace: GovernanceWorkspace = {
    id: 'workspace',
    name: 'workspace',
    root: '.',
    projects: [
      {
        id: 'a',
        name: 'a',
        root: 'packages/a',
        type: 'library',
        tags: [],
        ownership: { team: 'alpha', source: 'project-metadata' },
        metadata: { documentation: true },
      },
      {
        id: 'b',
        name: 'b',
        root: 'packages/b',
        type: 'library',
        tags: [],
        ownership: { source: 'none' },
        metadata: {},
      },
    ],
    dependencies: [
      { source: 'a', target: 'b', type: 'static' },
      { source: 'b', target: 'a', type: 'static' },
    ],
  };

  const violations: Violation[] = [
    {
      id: 'v1',
      ruleId: 'ownership-presence',
      project: 'b',
      severity: 'warning',
      message: 'missing ownership',
    },
  ];

  it('returns the full MVP metric set', () => {
    const metrics = calculateMetrics({
      workspace,
      signals: buildSignals(workspace, violations),
    });

    expect(metrics.map((metric) => metric.id)).toEqual([
      'architectural-entropy',
      'dependency-complexity',
      'domain-integrity',
      'ownership-coverage',
      'documentation-completeness',
      'layer-integrity',
    ]);
  });

  it('computes ownership coverage metric', () => {
    const metrics = calculateMetrics({
      workspace,
      signals: buildSignals(workspace, violations),
    });
    const ownershipCoverage = metrics.find(
      (metric) => metric.id === 'ownership-coverage'
    );

    expect(ownershipCoverage?.value).toBe(0.5);
    expect(ownershipCoverage?.score).toBe(50);
  });

  it('preserves the prior score values for the existing fixture', () => {
    const metrics = calculateMetrics({
      workspace,
      signals: buildSignals(workspace, violations),
    });

    expect(metricById(metrics, 'architectural-entropy')).toMatchObject({
      value: 0.5,
      score: 50,
    });
    expect(metricById(metrics, 'dependency-complexity')).toMatchObject({
      value: 0.25,
      score: 75,
    });
    expect(metricById(metrics, 'domain-integrity')).toMatchObject({
      value: 0,
      score: 100,
    });
    expect(metricById(metrics, 'ownership-coverage')).toMatchObject({
      value: 0.5,
      score: 50,
    });
    expect(metricById(metrics, 'documentation-completeness')).toMatchObject({
      value: 0.5,
      score: 50,
    });
    expect(metricById(metrics, 'layer-integrity')).toMatchObject({
      value: 0,
      score: 100,
    });
  });
});

function buildSignals(workspace: GovernanceWorkspace, violations: Violation[]) {
  return [
    ...workspace.dependencies.map((dependency, index) => ({
      id: `graph-${index}`,
      type: 'structural-dependency' as const,
      sourceProjectId: dependency.source,
      targetProjectId: dependency.target,
      relatedProjectIds: [dependency.source, dependency.target].sort(),
      severity: 'info' as const,
      category: 'dependency' as const,
      message: `Dependency: ${dependency.source} -> ${dependency.target}.`,
      source: 'graph' as const,
      createdAt: '2026-03-30T00:00:00.000Z',
      metadata: {
        dependencyType: dependency.type,
      },
    })),
    ...buildPolicySignals(violations, {
      createdAt: '2026-03-30T00:00:00.000Z',
    }),
  ];
}

function metricById(metrics: ReturnType<typeof calculateMetrics>, id: string) {
  return metrics.find((metric) => metric.id === id);
}

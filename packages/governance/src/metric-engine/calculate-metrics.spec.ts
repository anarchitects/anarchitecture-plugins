import { GovernanceWorkspace, Violation } from '../core/index.js';

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
    const metrics = calculateMetrics(workspace, violations);

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
    const metrics = calculateMetrics(workspace, violations);
    const ownershipCoverage = metrics.find(
      (metric) => metric.id === 'ownership-coverage'
    );

    expect(ownershipCoverage?.value).toBe(0.5);
    expect(ownershipCoverage?.score).toBe(50);
  });
});

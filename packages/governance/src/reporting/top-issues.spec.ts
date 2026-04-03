import type { GovernanceSignal } from '../signal-engine/index.js';

import { buildTopIssues } from './top-issues.js';

describe('top issues helpers', () => {
  it('groups identical issue scopes and ranks by severity then count', () => {
    const issues = buildTopIssues([
      signal({
        id: 'warning-1',
        type: 'cross-domain-dependency',
        source: 'graph',
        severity: 'warning',
        sourceProjectId: 'shop-app',
        targetProjectId: 'shared-ui',
        relatedProjectIds: ['shared-ui', 'shop-app'],
        message: 'Cross-domain dependency',
      }),
      signal({
        id: 'warning-2',
        type: 'cross-domain-dependency',
        source: 'graph',
        severity: 'warning',
        sourceProjectId: 'shop-app',
        targetProjectId: 'shared-ui',
        relatedProjectIds: ['shared-ui', 'shop-app'],
        message: 'Cross-domain dependency',
      }),
      signal({
        id: 'error-1',
        type: 'domain-boundary-violation',
        source: 'policy',
        severity: 'error',
        sourceProjectId: 'orders-app',
        targetProjectId: 'payments-feature',
        relatedProjectIds: ['orders-app', 'payments-feature'],
        message: 'Domain boundary violation',
        metadata: { ruleId: 'domain-boundary' },
      }),
    ]);

    expect(issues).toEqual([
      {
        type: 'domain-boundary-violation',
        source: 'policy',
        severity: 'error',
        count: 1,
        projects: ['orders-app', 'payments-feature'],
        ruleId: 'domain-boundary',
        message: 'Domain boundary violation',
      },
      {
        type: 'cross-domain-dependency',
        source: 'graph',
        severity: 'warning',
        count: 2,
        projects: ['shared-ui', 'shop-app'],
        ruleId: undefined,
        message: 'Cross-domain dependency',
      },
    ]);
  });

  it('keeps deterministic ordering for same-severity issues', () => {
    const issues = buildTopIssues([
      signal({
        id: 'ownership',
        type: 'ownership-gap',
        source: 'policy',
        severity: 'warning',
        sourceProjectId: 'billing-api',
        relatedProjectIds: ['billing-api'],
        message: 'Ownership gap',
      }),
      signal({
        id: 'conformance',
        type: 'conformance-violation',
        source: 'conformance',
        severity: 'warning',
        sourceProjectId: 'billing-api',
        relatedProjectIds: ['billing-api'],
        message: 'Conformance issue',
      }),
    ]);

    expect(issues.map((issue) => issue.type)).toEqual([
      'conformance-violation',
      'ownership-gap',
    ]);
  });
});

function signal(
  overrides: Partial<GovernanceSignal> & Pick<GovernanceSignal, 'id'>
): GovernanceSignal {
  return {
    id: overrides.id,
    type: overrides.type ?? 'conformance-violation',
    sourceProjectId: overrides.sourceProjectId,
    targetProjectId: overrides.targetProjectId,
    relatedProjectIds: overrides.relatedProjectIds ?? [],
    severity: overrides.severity ?? 'warning',
    category: overrides.category ?? 'boundary',
    message: overrides.message ?? overrides.id,
    metadata: overrides.metadata,
    source: overrides.source ?? 'graph',
    createdAt: overrides.createdAt ?? '2026-03-31T00:00:00.000Z',
  };
}

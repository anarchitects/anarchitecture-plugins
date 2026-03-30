import { GovernanceSignal } from '../signal-engine/index.js';

import {
  aggregateSignals,
  isEntropyPenaltyAggregate,
  sumSignalAggregateWeights,
} from './aggregate-signals.js';

describe('aggregateSignals', () => {
  it('groups repeated signals by deterministic source, type, severity, and project scope', () => {
    const aggregates = aggregateSignals([
      signal({
        id: 'policy-b',
        source: 'policy',
        type: 'ownership-gap',
        severity: 'warning',
        sourceProjectId: 'z-project',
      }),
      signal({
        id: 'graph-a-1',
        source: 'graph',
        type: 'cross-domain-dependency',
        severity: 'warning',
        sourceProjectId: 'a-project',
        targetProjectId: 'b-project',
      }),
      signal({
        id: 'graph-a-2',
        source: 'graph',
        type: 'cross-domain-dependency',
        severity: 'warning',
        sourceProjectId: 'a-project',
        targetProjectId: 'b-project',
      }),
      signal({
        id: 'conformance-a',
        source: 'conformance',
        type: 'conformance-violation',
        severity: 'error',
        sourceProjectId: 'm-project',
        targetProjectId: 'n-project',
      }),
    ]);

    expect(
      aggregates.map(
        (aggregate) =>
          `${aggregate.source}|${aggregate.type}|${aggregate.severity}|${aggregate.sourceProjectId ?? ''}|${aggregate.targetProjectId ?? ''}|${aggregate.count}`
      )
    ).toEqual([
      'graph|cross-domain-dependency|warning|a-project|b-project|2',
      'conformance|conformance-violation|error|m-project|n-project|1',
      'policy|ownership-gap|warning|z-project||1',
    ]);
  });

  it('produces stable aggregate totals independent of input order', () => {
    const first = aggregateSignals([
      signal({
        id: '1',
        source: 'graph',
        type: 'missing-domain-context',
        severity: 'warning',
        sourceProjectId: 'a',
        targetProjectId: 'b',
      }),
      signal({
        id: '2',
        source: 'graph',
        type: 'missing-domain-context',
        severity: 'warning',
        sourceProjectId: 'a',
        targetProjectId: 'b',
      }),
      signal({
        id: '3',
        source: 'policy',
        type: 'layer-boundary-violation',
        severity: 'warning',
        sourceProjectId: 'b',
        targetProjectId: 'c',
      }),
    ]);
    const second = aggregateSignals([
      signal({
        id: '3',
        source: 'policy',
        type: 'layer-boundary-violation',
        severity: 'warning',
        sourceProjectId: 'b',
        targetProjectId: 'c',
      }),
      signal({
        id: '2',
        source: 'graph',
        type: 'missing-domain-context',
        severity: 'warning',
        sourceProjectId: 'a',
        targetProjectId: 'b',
      }),
      signal({
        id: '1',
        source: 'graph',
        type: 'missing-domain-context',
        severity: 'warning',
        sourceProjectId: 'a',
        targetProjectId: 'b',
      }),
    ]);

    expect(first).toEqual(second);
  });

  it('applies fixed type and severity weights for mixed signal sets', () => {
    const aggregates = aggregateSignals([
      signal({
        id: 'info-structural',
        source: 'graph',
        type: 'structural-dependency',
        severity: 'info',
        sourceProjectId: 'a',
        targetProjectId: 'b',
      }),
      signal({
        id: 'warning-cross',
        source: 'graph',
        type: 'cross-domain-dependency',
        severity: 'warning',
        sourceProjectId: 'a',
        targetProjectId: 'c',
      }),
      signal({
        id: 'error-conformance',
        source: 'conformance',
        type: 'conformance-violation',
        severity: 'error',
        sourceProjectId: 'c',
        targetProjectId: 'd',
      }),
      signal({
        id: 'warning-ownership',
        source: 'policy',
        type: 'ownership-gap',
        severity: 'warning',
        sourceProjectId: 'z',
      }),
    ]);

    expect(
      aggregates.map((aggregate) => ({
        type: aggregate.type,
        severity: aggregate.severity,
        unitWeight: aggregate.unitWeight,
        totalWeight: aggregate.totalWeight,
      }))
    ).toEqual([
      {
        type: 'cross-domain-dependency',
        severity: 'warning',
        unitWeight: 0.42,
        totalWeight: 0.42,
      },
      {
        type: 'structural-dependency',
        severity: 'info',
        unitWeight: 0.25,
        totalWeight: 0.25,
      },
      {
        type: 'conformance-violation',
        severity: 'error',
        unitWeight: 1,
        totalWeight: 1,
      },
      {
        type: 'ownership-gap',
        severity: 'warning',
        unitWeight: 0.3,
        totalWeight: 0.3,
      },
    ]);
  });

  it('excludes structural dependencies from entropy penalty totals', () => {
    const aggregates = aggregateSignals([
      signal({
        id: 'structural',
        source: 'graph',
        type: 'structural-dependency',
        severity: 'info',
        sourceProjectId: 'a',
        targetProjectId: 'b',
      }),
      signal({
        id: 'missing-domain',
        source: 'graph',
        type: 'missing-domain-context',
        severity: 'warning',
        sourceProjectId: 'a',
        targetProjectId: 'b',
      }),
      signal({
        id: 'policy-domain',
        source: 'policy',
        type: 'domain-boundary-violation',
        severity: 'error',
        sourceProjectId: 'a',
        targetProjectId: 'c',
      }),
    ]);

    expect(
      sumSignalAggregateWeights(aggregates, isEntropyPenaltyAggregate)
    ).toBe(1.51);
  });
});

function signal(
  overrides: Partial<GovernanceSignal> &
    Pick<GovernanceSignal, 'id' | 'source' | 'type' | 'severity'>
): GovernanceSignal {
  const sourceProjectId = overrides.sourceProjectId;
  const targetProjectId = overrides.targetProjectId;

  return {
    id: overrides.id,
    source: overrides.source,
    type: overrides.type,
    severity: overrides.severity,
    category: overrides.category ?? 'boundary',
    message: overrides.message ?? overrides.id,
    sourceProjectId,
    targetProjectId,
    relatedProjectIds:
      overrides.relatedProjectIds ??
      [sourceProjectId, targetProjectId]
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => a.localeCompare(b)),
    metadata: overrides.metadata,
    createdAt: overrides.createdAt ?? '2026-03-30T00:00:00.000Z',
  };
}

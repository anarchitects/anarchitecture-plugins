import type { GovernanceSignal } from '../signal-engine/index.js';

import {
  buildSignalBreakdown,
  filterSignalsForReportType,
} from './signal-breakdown.js';

describe('signal breakdown helpers', () => {
  it('returns source counts in fixed order independent of input order', () => {
    const signals = [
      makeSignal({
        id: 'policy-boundary',
        source: 'policy',
        type: 'domain-boundary-violation',
        category: 'boundary',
      }),
      makeSignal({
        id: 'conformance-boundary',
        source: 'conformance',
        type: 'conformance-violation',
        category: 'boundary',
      }),
      makeSignal({
        id: 'graph-structural',
        source: 'graph',
        type: 'structural-dependency',
        category: 'dependency',
      }),
      makeSignal({
        id: 'graph-domain',
        source: 'graph',
        type: 'cross-domain-dependency',
        category: 'boundary',
      }),
    ];

    expect(buildSignalBreakdown(signals)).toEqual(
      buildSignalBreakdown([...signals].reverse())
    );
    expect(buildSignalBreakdown(signals)).toEqual({
      total: 4,
      bySource: [
        { source: 'graph', count: 2 },
        { source: 'conformance', count: 1 },
        { source: 'policy', count: 1 },
      ],
    });
  });

  it('includes zero-count buckets for absent sources', () => {
    expect(
      buildSignalBreakdown([
        makeSignal({
          id: 'graph-only',
          source: 'graph',
          type: 'structural-dependency',
          category: 'dependency',
        }),
      ])
    ).toEqual({
      total: 1,
      bySource: [
        { source: 'graph', count: 1 },
        { source: 'conformance', count: 0 },
        { source: 'policy', count: 0 },
      ],
    });
  });

  it('filters signal sets by report type before breakdown', () => {
    const signals = [
      makeSignal({
        id: 'graph-structural',
        source: 'graph',
        type: 'structural-dependency',
        category: 'dependency',
      }),
      makeSignal({
        id: 'graph-boundary',
        source: 'graph',
        type: 'cross-domain-dependency',
        category: 'boundary',
      }),
      makeSignal({
        id: 'conformance-ownership',
        source: 'conformance',
        type: 'conformance-violation',
        category: 'ownership',
      }),
      makeSignal({
        id: 'policy-ownership',
        source: 'policy',
        type: 'ownership-gap',
        category: 'ownership',
      }),
    ];

    expect(
      filterSignalsForReportType(signals, 'boundaries').map((s) => s.id)
    ).toEqual(['graph-boundary']);
    expect(
      filterSignalsForReportType(signals, 'ownership').map((s) => s.id)
    ).toEqual(['conformance-ownership', 'policy-ownership']);
    expect(
      filterSignalsForReportType(signals, 'architecture').map((s) => s.id)
    ).toEqual(['graph-structural', 'graph-boundary']);
    expect(
      filterSignalsForReportType(signals, 'health').map((s) => s.id)
    ).toEqual(signals.map((signal) => signal.id));
  });
});

function makeSignal(
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
    createdAt: overrides.createdAt ?? '2026-03-30T00:00:00.000Z',
  };
}

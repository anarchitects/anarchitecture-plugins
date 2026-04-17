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
        severity: 'info',
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
        { source: 'extension', count: 0 },
      ],
      byType: [
        { type: 'structural-dependency', count: 1 },
        { type: 'cross-domain-dependency', count: 1 },
        { type: 'conformance-violation', count: 1 },
        { type: 'domain-boundary-violation', count: 1 },
      ],
      bySeverity: [
        { severity: 'info', count: 1 },
        { severity: 'warning', count: 3 },
        { severity: 'error', count: 0 },
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
          severity: 'info',
        }),
      ])
    ).toEqual({
      total: 1,
      bySource: [
        { source: 'graph', count: 1 },
        { source: 'conformance', count: 0 },
        { source: 'policy', count: 0 },
        { source: 'extension', count: 0 },
      ],
      byType: [{ type: 'structural-dependency', count: 1 }],
      bySeverity: [
        { severity: 'info', count: 1 },
        { severity: 'warning', count: 0 },
        { severity: 'error', count: 0 },
      ],
    });
  });

  it('filters signal sets by report type before type and severity aggregation', () => {
    const signals = [
      makeSignal({
        id: 'graph-structural',
        source: 'graph',
        type: 'structural-dependency',
        category: 'dependency',
        severity: 'info',
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

  it('keeps type ordering deterministic and observed-only', () => {
    const breakdown = buildSignalBreakdown([
      makeSignal({
        id: 'policy-ownership',
        source: 'policy',
        type: 'ownership-gap',
        category: 'ownership',
      }),
      makeSignal({
        id: 'graph-missing-domain',
        source: 'graph',
        type: 'missing-domain-context',
        category: 'boundary',
      }),
      makeSignal({
        id: 'graph-structural',
        source: 'graph',
        type: 'structural-dependency',
        category: 'dependency',
        severity: 'info',
      }),
      makeSignal({
        id: 'conformance-boundary',
        source: 'conformance',
        type: 'conformance-violation',
        category: 'boundary',
        severity: 'error',
      }),
    ]);

    expect(breakdown.byType).toEqual([
      { type: 'structural-dependency', count: 1 },
      { type: 'missing-domain-context', count: 1 },
      { type: 'conformance-violation', count: 1 },
      { type: 'ownership-gap', count: 1 },
    ]);
    expect(
      breakdown.byType.find((entry) => entry.type === 'circular-dependency')
    ).toBeUndefined();
    expect(breakdown.bySeverity).toEqual([
      { severity: 'info', count: 1 },
      { severity: 'warning', count: 2 },
      { severity: 'error', count: 1 },
    ]);
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

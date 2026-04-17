import type { SignalBreakdown } from '../core/index.js';
import type {
  GovernanceSignal,
  GovernanceSignalSource,
  GovernanceSignalSeverity,
  KnownGovernanceSignalType,
  GovernanceSignalType,
} from '../signal-engine/index.js';

export type GovernanceReportType =
  | 'health'
  | 'boundaries'
  | 'ownership'
  | 'architecture';

const SOURCE_ORDER: GovernanceSignalSource[] = [
  'graph',
  'conformance',
  'policy',
  'extension',
];
const SEVERITY_ORDER: GovernanceSignalSeverity[] = ['info', 'warning', 'error'];
const TYPE_ORDER: KnownGovernanceSignalType[] = [
  'structural-dependency',
  'cross-domain-dependency',
  'missing-domain-context',
  'circular-dependency',
  'conformance-violation',
  'domain-boundary-violation',
  'layer-boundary-violation',
  'ownership-gap',
];

export function filterSignalsForReportType(
  signals: GovernanceSignal[],
  reportType: GovernanceReportType | undefined
): GovernanceSignal[] {
  if (reportType === 'boundaries') {
    return signals.filter((signal) => signal.category === 'boundary');
  }

  if (reportType === 'ownership') {
    return signals.filter((signal) => signal.category === 'ownership');
  }

  if (reportType === 'architecture') {
    return signals.filter((signal) => signal.category !== 'ownership');
  }

  return signals;
}

export function buildSignalBreakdown(
  signals: GovernanceSignal[]
): SignalBreakdown {
  const sourceCounts = new Map<string, number>();
  const typeCounts = new Map<GovernanceSignalType, number>();
  const severityCounts = new Map<GovernanceSignalSeverity, number>();

  for (const signal of signals) {
    sourceCounts.set(signal.source, (sourceCounts.get(signal.source) ?? 0) + 1);
    typeCounts.set(signal.type, (typeCounts.get(signal.type) ?? 0) + 1);
    severityCounts.set(
      signal.severity,
      (severityCounts.get(signal.severity) ?? 0) + 1
    );
  }

  return {
    total: signals.length,
    bySource: [
      ...SOURCE_ORDER.map((source) => ({
        source,
        count: sourceCounts.get(source) ?? 0,
      })),
      ...sortKnownThenAlphabetical<GovernanceSignalSource>(
        [...sourceCounts.keys()] as GovernanceSignalSource[],
        SOURCE_ORDER
      )
        .filter((source) => !SOURCE_ORDER.includes(source))
        .map((source) => ({
          source,
          count: sourceCounts.get(source) ?? 0,
        })),
    ],
    byType: sortKnownThenAlphabetical(
      [...typeCounts.keys()],
      TYPE_ORDER
    ).flatMap((type) => {
      const count = typeCounts.get(type) ?? 0;

      return count > 0 ? [{ type, count }] : [];
    }),
    bySeverity: SEVERITY_ORDER.map((severity) => ({
      severity,
      count: severityCounts.get(severity) ?? 0,
    })),
  };
}

function sortKnownThenAlphabetical<T extends string>(
  values: T[],
  knownOrder: readonly T[]
): T[] {
  const seen = new Set(values);
  const orderedKnown = knownOrder.filter((value) => seen.has(value));
  const orderedExtras = values
    .filter((value) => !knownOrder.includes(value))
    .sort((a, b) => a.localeCompare(b));

  return [...orderedKnown, ...orderedExtras];
}

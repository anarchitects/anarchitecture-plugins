import type { SignalBreakdown } from '../core/index.js';
import type { GovernanceSignal } from '../signal-engine/index.js';

export type GovernanceReportType =
  | 'health'
  | 'boundaries'
  | 'ownership'
  | 'architecture';

const SOURCE_ORDER = ['graph', 'conformance', 'policy'] as const;

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
  const counts = new Map<string, number>();

  for (const signal of signals) {
    counts.set(signal.source, (counts.get(signal.source) ?? 0) + 1);
  }

  return {
    total: signals.length,
    bySource: SOURCE_ORDER.map((source) => ({
      source,
      count: counts.get(source) ?? 0,
    })),
  };
}

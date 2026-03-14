import {
  DriftSignal,
  MetricSnapshot,
  SnapshotComparison,
  SnapshotMetricDelta,
} from '../core/index.js';

export function compareSnapshots(
  baseline: MetricSnapshot,
  current: MetricSnapshot
): SnapshotComparison {
  return {
    baseline,
    current,
    metricDeltas: diffNumberMap(baseline.metrics, current.metrics),
    scoreDeltas: diffNumberMap(baseline.scores, current.scores),
    newViolations: current.violations.filter(
      (violation) => !hasViolation(baseline.violations, violation)
    ),
    resolvedViolations: baseline.violations.filter(
      (violation) => !hasViolation(current.violations, violation)
    ),
  };
}

export function summarizeDrift(
  comparison: SnapshotComparison,
  threshold = 0.02
): DriftSignal[] {
  return comparison.scoreDeltas.map((delta) => ({
    id: delta.id,
    status: classifyDelta(delta.delta, threshold),
    magnitude: Math.abs(delta.delta),
    details: {
      baseline: delta.baseline,
      current: delta.current,
      delta: delta.delta,
    },
  }));
}

function diffNumberMap(
  baseline: Record<string, number>,
  current: Record<string, number>
): SnapshotMetricDelta[] {
  const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);

  return [...keys]
    .sort((a, b) => a.localeCompare(b))
    .map((id) => {
      const before = baseline[id] ?? 0;
      const after = current[id] ?? 0;
      return {
        id,
        baseline: before,
        current: after,
        delta: round(after - before),
      };
    });
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function classifyDelta(
  delta: number,
  threshold: number
): DriftSignal['status'] {
  if (Math.abs(delta) < threshold) {
    return 'stable';
  }

  return delta > 0 ? 'improving' : 'worsening';
}

function hasViolation(
  haystack: MetricSnapshot['violations'],
  needle: MetricSnapshot['violations'][number]
): boolean {
  return haystack.some(
    (candidate) =>
      candidate.type === needle.type &&
      candidate.source === needle.source &&
      candidate.target === needle.target
  );
}

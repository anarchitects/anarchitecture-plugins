import type {
  GovernanceDependency,
  SnapshotViolation,
} from '@anarchitects/governance-core';

export const AI_PAYLOAD_LIMITS = {
  rootCauseDependencies: 120,
  prImpactDependencies: 120,
  driftSignals: 12,
  driftDeltas: 12,
  driftViolations: 20,
  scorecardViolations: 20,
  scorecardDeltas: 12,
};

export interface TruncationMetadata {
  totalCount: number;
  selectedCount: number;
  limit: number;
  truncated: boolean;
}

export function sliceDependenciesForProjectScope(
  dependencies: GovernanceDependency[],
  projectScope: Set<string>,
  limit: number
): { items: GovernanceDependency[]; truncation: TruncationMetadata } {
  const filtered = dependencies.filter(
    (dependency) =>
      projectScope.has(dependency.source) || projectScope.has(dependency.target)
  );

  const sorted = [...filtered].sort(
    (a, b) =>
      a.source.localeCompare(b.source) ||
      a.target.localeCompare(b.target) ||
      a.type.localeCompare(b.type)
  );

  const items = sorted.slice(0, Math.max(0, limit));
  return {
    items,
    truncation: buildTruncationMetadata(sorted.length, items.length, limit),
  };
}

export function buildTruncationMetadata(
  totalCount: number,
  selectedCount: number,
  limit: number
): TruncationMetadata {
  return {
    totalCount,
    selectedCount,
    limit,
    truncated: selectedCount < totalCount,
  };
}

export function sliceTopItems<T>(
  items: T[],
  limit: number,
  compare: (a: T, b: T) => number
): { items: T[]; truncation: TruncationMetadata } {
  const sorted = [...items].sort(compare);
  const selected = sorted.slice(0, Math.max(0, limit));

  return {
    items: selected,
    truncation: buildTruncationMetadata(sorted.length, selected.length, limit),
  };
}

export function compareViolationsForPriority(
  a: SnapshotViolation,
  b: SnapshotViolation
): number {
  const severityRank = (severity?: SnapshotViolation['severity']): number => {
    if (severity === 'error') return 3;
    if (severity === 'warning') return 2;
    if (severity === 'info') return 1;
    return 0;
  };

  return (
    severityRank(b.severity) - severityRank(a.severity) ||
    (a.source ?? '').localeCompare(b.source ?? '') ||
    (a.type ?? '').localeCompare(b.type ?? '') ||
    (a.target ?? '').localeCompare(b.target ?? '')
  );
}

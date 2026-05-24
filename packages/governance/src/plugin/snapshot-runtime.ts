import { workspaceRoot } from '@nx/devkit';
import {
  compareSnapshots,
  type DeliveryImpactAssessment,
  type SnapshotComparison,
  type SnapshotDeliveryImpactSummary,
} from '@anarchitects/governance-core';
import path from 'node:path';

import {
  listMetricSnapshots,
  readMetricSnapshot,
} from '../snapshot-store/index.js';

export function resolveSnapshotPath(
  explicitPath: string | undefined,
  fallbackPath: string | undefined
): string | undefined {
  if (!explicitPath) {
    return fallbackPath;
  }

  return path.isAbsolute(explicitPath)
    ? explicitPath
    : path.resolve(workspaceRoot, explicitPath);
}

export async function resolveOptionalSnapshotComparison(options: {
  snapshotDir?: string;
  baseline?: string;
  current?: string;
}): Promise<SnapshotComparison | undefined> {
  const snapshotPaths = await listMetricSnapshots(options.snapshotDir);
  const baselinePath = resolveSnapshotPath(
    options.baseline,
    snapshotPaths.at(-2)
  );
  const currentPath = resolveSnapshotPath(
    options.current,
    snapshotPaths.at(-1)
  );

  if (!baselinePath || !currentPath) {
    return undefined;
  }

  const baseline = await readMetricSnapshot(baselinePath);
  const current = await readMetricSnapshot(currentPath);

  return compareSnapshots(baseline, current);
}

export function toSnapshotDeliveryImpactSummary(
  deliveryImpact: DeliveryImpactAssessment
): SnapshotDeliveryImpactSummary {
  return {
    indices: deliveryImpact.indices
      .map((index) => ({
        id: index.id,
        score: index.score,
        risk: index.risk,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    topDrivers: deliveryImpact.drivers.slice(0, 5).map((driver) => ({
      id: driver.id,
      label: driver.label,
      value: driver.value,
      score: driver.score,
      unit: driver.unit,
      trend: driver.trend,
    })),
  };
}

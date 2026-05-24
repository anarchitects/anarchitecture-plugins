import { workspaceRoot } from '@nx/devkit';
import {
  compareSnapshots,
  type SnapshotComparison,
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

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { workspaceRoot } from '@nx/devkit';

import {
  buildMetricSnapshot,
  GovernanceAssessment,
  MetricSnapshot,
  SnapshotDeliveryImpactSummary,
} from '../core/index.js';

const DEFAULT_SNAPSHOT_DIR = '.governance-metrics/snapshots';

interface SaveMetricSnapshotOptions {
  assessment: GovernanceAssessment;
  snapshotDir?: string;
  repo?: string;
  branch?: string;
  commitSha?: string;
  pluginVersion?: string;
  metricSchemaVersion?: string;
  deliveryImpact?: SnapshotDeliveryImpactSummary;
  now?: Date;
}

interface SaveMetricSnapshotResult {
  snapshot: MetricSnapshot;
  filePath: string;
  relativePath: string;
}

export async function saveMetricSnapshot(
  options: SaveMetricSnapshotOptions
): Promise<SaveMetricSnapshotResult> {
  const now = options.now ?? new Date();
  const timestamp = now.toISOString();
  const snapshotDirectory = path.resolve(
    workspaceRoot,
    options.snapshotDir ?? DEFAULT_SNAPSHOT_DIR
  );

  const snapshot = buildMetricSnapshot(options.assessment, {
    timestamp,
    repo: options.repo ?? inferRepoName(),
    branch: options.branch ?? inferGitRef('branch'),
    commitSha: options.commitSha ?? inferGitRef('sha'),
    pluginVersion: options.pluginVersion ?? '0.1.0',
    metricSchemaVersion: options.metricSchemaVersion ?? '1.2',
    deliveryImpact: options.deliveryImpact,
  });

  await fs.mkdir(snapshotDirectory, { recursive: true });

  const fileName = `${formatTimestampForFilename(now)}.json`;
  const filePath = path.join(snapshotDirectory, fileName);

  await fs.writeFile(
    filePath,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    'utf8'
  );

  return {
    snapshot,
    filePath,
    relativePath: path.relative(workspaceRoot, filePath),
  };
}

export async function readMetricSnapshot(
  filePath: string
): Promise<MetricSnapshot> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as MetricSnapshot;
}

export async function listMetricSnapshots(
  snapshotDir?: string
): Promise<string[]> {
  const resolvedDir = path.resolve(
    workspaceRoot,
    snapshotDir ?? DEFAULT_SNAPSHOT_DIR
  );

  try {
    const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => path.join(resolvedDir, entry.name))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export function formatTimestampForFilename(date: Date): string {
  return date
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, '');
}

function inferRepoName(): string {
  return path.basename(workspaceRoot);
}

function inferGitRef(type: 'branch' | 'sha'): string {
  try {
    if (type === 'branch') {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: workspaceRoot,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    }

    return execSync('git rev-parse --short HEAD', {
      cwd: workspaceRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

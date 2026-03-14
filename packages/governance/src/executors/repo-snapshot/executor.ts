import { runGovernanceSnapshot } from '../../plugin/run-governance.js';
import { GovernanceSnapshotExecutorOptions } from '../types.js';

export default async function repoSnapshotExecutor(
  options: GovernanceSnapshotExecutorOptions
): Promise<{ success: boolean }> {
  const result = await runGovernanceSnapshot({
    profile: options.profile,
    output: options.output,
    failOnViolation: options.failOnViolation,
    snapshotDir: options.snapshotDir,
    metricSchemaVersion: options.metricSchemaVersion,
  });

  return { success: result.success };
}

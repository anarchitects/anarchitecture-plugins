import { runGovernanceManagementInsights } from '../../plugin/run-governance.js';
import { GovernanceManagementInsightsExecutorOptions } from '../types.js';

export default async function repoManagementInsightsExecutor(
  options: GovernanceManagementInsightsExecutorOptions
): Promise<{ success: boolean }> {
  const result = await runGovernanceManagementInsights({
    profile: options.profile,
    output: options.output,
    snapshotDir: options.snapshotDir,
    baseline: options.baseline,
    current: options.current,
    failOnViolation: options.failOnViolation,
  });

  return { success: result.success };
}

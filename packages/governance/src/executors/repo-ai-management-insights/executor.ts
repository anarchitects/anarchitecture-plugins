import { runGovernanceAiManagementInsights } from '../../plugin/run-governance.js';
import { GovernanceAiManagementInsightsExecutorOptions } from '../types.js';

export default async function repoAiManagementInsightsExecutor(
  options: GovernanceAiManagementInsightsExecutorOptions
): Promise<{ success: boolean }> {
  const result = await runGovernanceAiManagementInsights({
    profile: options.profile,
    output: options.output,
    failOnViolation: options.failOnViolation,
    snapshotDir: options.snapshotDir,
    baseline: options.baseline,
    current: options.current,
  });

  return { success: result.success };
}

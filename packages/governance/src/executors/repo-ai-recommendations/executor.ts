import { runGovernanceAiRecommendations } from '../../plugin/run-governance.js';
import { GovernanceAiExecutorOptions } from '../types.js';

export default async function repoAiRecommendationsExecutor(
  options: GovernanceAiExecutorOptions
): Promise<{ success: boolean }> {
  const result = await runGovernanceAiRecommendations({
    profile: options.profile,
    output: options.output,
    failOnViolation: options.failOnViolation,
    snapshotDir: options.snapshotDir,
    topViolations: options.topViolations,
  });

  return { success: result.success };
}

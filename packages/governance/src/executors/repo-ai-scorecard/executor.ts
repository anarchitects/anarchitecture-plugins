import { runGovernanceAiScorecard } from '../../plugin/run-governance.js';
import { GovernanceAiExecutorOptions } from '../types.js';

export default async function repoAiScorecardExecutor(
  options: GovernanceAiExecutorOptions
): Promise<{ success: boolean }> {
  const result = await runGovernanceAiScorecard({
    profile: options.profile,
    output: options.output,
    failOnViolation: options.failOnViolation,
    snapshotDir: options.snapshotDir,
    snapshotPath: options.snapshotPath,
  });

  return { success: result.success };
}

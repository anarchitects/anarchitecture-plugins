import { runGovernanceAiRootCause } from '../../plugin/run-governance.js';
import { GovernanceAiExecutorOptions } from '../types.js';

export default async function repoAiRootCauseExecutor(
  options: GovernanceAiExecutorOptions
): Promise<{ success: boolean }> {
  const result = await runGovernanceAiRootCause({
    profile: options.profile,
    output: options.output,
    failOnViolation: options.failOnViolation,
    snapshotDir: options.snapshotDir,
    snapshotPath: options.snapshotPath,
    topViolations: options.topViolations,
  });

  return { success: result.success };
}

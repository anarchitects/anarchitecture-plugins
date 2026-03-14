import { runGovernanceAiDrift } from '../../plugin/run-governance.js';
import { GovernanceDriftExecutorOptions } from '../types.js';

export default async function repoAiDriftExecutor(
  options: GovernanceDriftExecutorOptions
): Promise<{ success: boolean }> {
  const result = await runGovernanceAiDrift({
    profile: options.profile,
    output: options.output,
    failOnViolation: options.failOnViolation,
    snapshotDir: options.snapshotDir,
    baseline: options.baseline,
    current: options.current,
  });

  return { success: result.success };
}

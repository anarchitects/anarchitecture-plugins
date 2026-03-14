import { runGovernanceAiPrImpact } from '../../plugin/run-governance.js';
import { GovernanceAiPrImpactExecutorOptions } from '../types.js';

export default async function repoAiPrImpactExecutor(
  options: GovernanceAiPrImpactExecutorOptions
): Promise<{ success: boolean }> {
  const result = await runGovernanceAiPrImpact({
    profile: options.profile,
    output: options.output,
    failOnViolation: options.failOnViolation,
    baseRef: options.baseRef,
    headRef: options.headRef,
  });

  return { success: result.success };
}

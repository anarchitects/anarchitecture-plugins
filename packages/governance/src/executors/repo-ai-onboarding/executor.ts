import { runGovernanceAiOnboarding } from '../../plugin/run-governance.js';
import { GovernanceAiOnboardingExecutorOptions } from '../types.js';

export default async function repoAiOnboardingExecutor(
  options: GovernanceAiOnboardingExecutorOptions
): Promise<{ success: boolean }> {
  const result = await runGovernanceAiOnboarding({
    profile: options.profile,
    output: options.output,
    failOnViolation: options.failOnViolation,
    topViolations: options.topViolations,
    topProjects: options.topProjects,
  });

  return { success: result.success };
}

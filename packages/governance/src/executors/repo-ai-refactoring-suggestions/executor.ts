import { runGovernanceAiRefactoringSuggestions } from '../../plugin/run-governance.js';
import { GovernanceAiRefactoringSuggestionsExecutorOptions } from '../types.js';

export default async function repoAiRefactoringSuggestionsExecutor(
  options: GovernanceAiRefactoringSuggestionsExecutorOptions
): Promise<{ success: boolean }> {
  const result = await runGovernanceAiRefactoringSuggestions({
    profile: options.profile,
    output: options.output,
    failOnViolation: options.failOnViolation,
    snapshotDir: options.snapshotDir,
    topViolations: options.topViolations,
    topProjects: options.topProjects,
  });

  return { success: result.success };
}

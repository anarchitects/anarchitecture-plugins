import { runGovernanceAiCognitiveLoad } from '../../plugin/run-governance.js';
import { GovernanceAiCognitiveLoadExecutorOptions } from '../types.js';

export default async function repoAiCognitiveLoadExecutor(
  options: GovernanceAiCognitiveLoadExecutorOptions
): Promise<{ success: boolean }> {
  const result = await runGovernanceAiCognitiveLoad({
    profile: options.profile,
    output: options.output,
    failOnViolation: options.failOnViolation,
    project: options.project,
    domain: options.domain,
    topProjects: options.topProjects,
  });

  return { success: result.success };
}

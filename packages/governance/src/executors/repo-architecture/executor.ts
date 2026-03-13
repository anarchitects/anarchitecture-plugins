import { ExecutorContext } from '@nx/devkit';

import { runGovernanceExecutor } from '../shared.js';
import { GovernanceExecutorOptions } from '../types.js';

export default async function repoArchitectureExecutor(
  options: GovernanceExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  return runGovernanceExecutor(options, context, 'architecture');
}

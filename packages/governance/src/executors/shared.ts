import { ExecutorContext } from '@nx/devkit';

import { GovernanceExecutorOptions } from './types.js';
import { runGovernance } from '../plugin/run-governance.js';

export async function runGovernanceExecutor(
  options: GovernanceExecutorOptions,
  _context: ExecutorContext,
  reportType: 'health' | 'boundaries' | 'ownership' | 'architecture'
): Promise<{ success: boolean }> {
  const result = await runGovernance({
    profile: options.profile,
    output: options.output,
    failOnViolation: options.failOnViolation,
    conformanceJson: options.conformanceJson,
    reportType,
  });

  return { success: result.success };
}

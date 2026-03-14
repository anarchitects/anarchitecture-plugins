import { runGovernanceDrift } from '../../plugin/run-governance.js';
import { GovernanceDriftExecutorOptions } from '../types.js';

export default async function repoDriftExecutor(
  options: GovernanceDriftExecutorOptions
): Promise<{ success: boolean }> {
  const result = await runGovernanceDrift({
    output: options.output,
    snapshotDir: options.snapshotDir,
    baseline: options.baseline,
    current: options.current,
  });

  return { success: result.success };
}

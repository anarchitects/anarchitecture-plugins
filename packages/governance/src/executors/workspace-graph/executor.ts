import { logger } from '@nx/devkit';

import { summarizeNxGovernanceWorkspaceGraph } from '../../plugin/compose-governance-runtime.js';
import { WorkspaceGraphExecutorOptions } from '../types.js';

interface GraphSummary {
  projectCount: number;
  dependencyCount: number;
}

export default async function workspaceGraphExecutor(
  options: WorkspaceGraphExecutorOptions = {}
): Promise<{ success: boolean }> {
  return runWorkspaceGraphExecutor(options);
}

interface WorkspaceGraphExecutorDeps {
  summarizeGraph: (
    options: WorkspaceGraphExecutorOptions
  ) => Promise<{ summary: GraphSummary }>;
  info: (message: string) => void;
  error: (message: string) => void;
}

const defaultDeps: WorkspaceGraphExecutorDeps = {
  summarizeGraph: (options) =>
    summarizeNxGovernanceWorkspaceGraph({
      graphJson: options.graphJson,
    }),
  info: (message) => logger.info(message),
  error: (message) => logger.error(message),
};

export async function runWorkspaceGraphExecutor(
  options: WorkspaceGraphExecutorOptions = {},
  deps: WorkspaceGraphExecutorDeps = defaultDeps
): Promise<{ success: boolean }> {
  try {
    const { summary } = await deps.summarizeGraph(options);

    deps.info(renderWorkspaceGraphSummary(summary));
    return { success: true };
  } catch (error) {
    deps.error(
      error instanceof Error
        ? error.message
        : 'Unable to read workspace graph snapshot.'
    );
    return { success: false };
  }
}

export function renderWorkspaceGraphSummary(summary: GraphSummary): string {
  return `Projects: ${summary.projectCount}\nDependencies: ${summary.dependencyCount}`;
}

import { logger } from '@nx/devkit';

import {
  GraphSummary,
  WorkspaceGraphSnapshot,
  readWorkspaceGraphSnapshot,
  summarizeWorkspaceGraph,
} from '../../nx-adapter/graph-adapter.js';
import { WorkspaceGraphExecutorOptions } from '../types.js';

export default async function workspaceGraphExecutor(
  options: WorkspaceGraphExecutorOptions = {}
): Promise<{ success: boolean }> {
  return runWorkspaceGraphExecutor(options);
}

interface WorkspaceGraphExecutorDeps {
  readSnapshot: (
    options: WorkspaceGraphExecutorOptions
  ) => Promise<WorkspaceGraphSnapshot>;
  summarize: (snapshot: WorkspaceGraphSnapshot) => GraphSummary;
  info: (message: string) => void;
  error: (message: string) => void;
}

const defaultDeps: WorkspaceGraphExecutorDeps = {
  readSnapshot: (options) =>
    readWorkspaceGraphSnapshot({
      graphJson: options.graphJson,
    }),
  summarize: (snapshot) => summarizeWorkspaceGraph(snapshot),
  info: (message) => logger.info(message),
  error: (message) => logger.error(message),
};

export async function runWorkspaceGraphExecutor(
  options: WorkspaceGraphExecutorOptions = {},
  deps: WorkspaceGraphExecutorDeps = defaultDeps
): Promise<{ success: boolean }> {
  try {
    const snapshot = await deps.readSnapshot(options);
    const summary = deps.summarize(snapshot);

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

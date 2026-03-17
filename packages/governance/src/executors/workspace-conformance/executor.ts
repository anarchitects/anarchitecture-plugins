import { logger } from '@nx/devkit';

import {
  ConformanceAdapterError,
  ConformanceSnapshot,
  readConformanceSnapshot,
  summarizeConformance,
} from '../../conformance-adapter/conformance-adapter.js';
import { WorkspaceConformanceExecutorOptions } from '../types.js';

export default async function workspaceConformanceExecutor(
  options: WorkspaceConformanceExecutorOptions
): Promise<{ success: boolean }> {
  return runWorkspaceConformanceExecutor(options);
}

interface WorkspaceConformanceExecutorDeps {
  readSnapshot: (
    options: WorkspaceConformanceExecutorOptions
  ) => ConformanceSnapshot | Promise<ConformanceSnapshot>;
  summarize: (snapshot: ConformanceSnapshot) => {
    total: number;
    errors: number;
    warnings: number;
  };
  info: (message: string) => void;
  error: (message: string) => void;
}

const defaultDeps: WorkspaceConformanceExecutorDeps = {
  readSnapshot: (options) =>
    readConformanceSnapshot({
      conformanceJson: options.conformanceJson,
    }),
  summarize: (snapshot) => summarizeConformance(snapshot),
  info: (message) => logger.info(message),
  error: (message) => logger.error(message),
};

export async function runWorkspaceConformanceExecutor(
  options: WorkspaceConformanceExecutorOptions,
  deps: WorkspaceConformanceExecutorDeps = defaultDeps
): Promise<{ success: boolean }> {
  try {
    const snapshot = await deps.readSnapshot(options);
    const summary = deps.summarize(snapshot);

    deps.info(renderWorkspaceConformanceSummary(summary));
    return { success: true };
  } catch (error) {
    deps.error(toUserFriendlyConformanceError(error));
    return { success: false };
  }
}

export function renderWorkspaceConformanceSummary(summary: {
  total: number;
  errors: number;
  warnings: number;
}): string {
  return `Findings: ${summary.total}\nErrors: ${summary.errors}\nWarnings: ${summary.warnings}`;
}

function toUserFriendlyConformanceError(error: unknown): string {
  if (error instanceof ConformanceAdapterError) {
    return `Unable to read Nx Conformance results (${error.reason}): ${error.message}`;
  }

  if (error instanceof Error) {
    return `Unable to read Nx Conformance results: ${error.message}`;
  }

  return 'Unable to read Nx Conformance results: unexpected error.';
}

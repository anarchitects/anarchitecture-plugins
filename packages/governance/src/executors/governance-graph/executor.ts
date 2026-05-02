import { logger, workspaceRoot } from '@nx/devkit';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

import type { GovernanceGraphDocument } from '../../graph-document/contracts.js';
import { buildGovernanceGraphDocument } from '../../graph-document/index.js';
import { buildGovernanceAssessmentArtifacts } from '../../plugin/run-governance.js';
import type { GovernanceAssessmentArtifacts } from '../../plugin/build-assessment-artifacts.js';
import type { GovernanceGraphExecutorOptions } from '../types.js';
import { renderGovernanceGraphViewerHtml } from './viewer.js';

type GovernanceGraphFormat = 'json' | 'html';

interface GovernanceGraphExecutorDeps {
  buildArtifacts: (
    options: GovernanceGraphExecutorOptions
  ) => Promise<GovernanceAssessmentArtifacts>;
  buildDocument: (
    artifacts: GovernanceAssessmentArtifacts
  ) => GovernanceGraphDocument;
  ensureDirectory: (directoryPath: string) => Promise<void>;
  writeOutput: (outputPath: string, contents: string) => Promise<void>;
  info: (message: string) => void;
  error: (message: string) => void;
}

const defaultDeps: GovernanceGraphExecutorDeps = {
  buildArtifacts: (options) =>
    buildGovernanceAssessmentArtifacts({
      profile: options.profile,
      failOnViolation: options.failOnViolation,
      conformanceJson: options.conformanceJson,
      reportType: 'health',
    }),
  buildDocument: (artifacts) =>
    buildGovernanceGraphDocument({
      assessment: artifacts.assessment,
      signals: artifacts.signals,
    }),
  ensureDirectory: async (directoryPath) => {
    await mkdir(directoryPath, { recursive: true });
  },
  writeOutput: (outputPath, contents) =>
    writeFile(outputPath, contents, 'utf8'),
  info: (message) => logger.info(message),
  error: (message) => logger.error(message),
};

export default async function governanceGraphExecutor(
  options: GovernanceGraphExecutorOptions = {}
): Promise<{ success: boolean }> {
  return runGovernanceGraphExecutor(options);
}

export async function runGovernanceGraphExecutor(
  options: GovernanceGraphExecutorOptions = {},
  deps: GovernanceGraphExecutorDeps = defaultDeps
): Promise<{ success: boolean }> {
  try {
    const format = normalizeFormat(options.format);
    if (!format) {
      deps.error(
        `Unsupported governance graph format: ${String(options.format)}.`
      );
      return { success: false };
    }

    const artifacts = await deps.buildArtifacts(options);
    const graphDocument = deps.buildDocument(artifacts);
    const outputPath = resolveOutputPath(format, options.outputPath);
    const contents =
      format === 'json'
        ? renderGovernanceGraphJson(graphDocument)
        : renderGovernanceGraphHtml(graphDocument);

    await deps.ensureDirectory(dirname(outputPath));
    await deps.writeOutput(outputPath, contents);

    deps.info(`Governance graph ${format} written to ${outputPath}.`);

    const success =
      !options.failOnViolation ||
      (artifacts.assessment.violations?.length ?? 0) === 0;

    return { success };
  } catch (error) {
    deps.error(
      error instanceof Error
        ? error.message
        : 'Unable to generate governance graph output.'
    );
    return { success: false };
  }
}

export function renderGovernanceGraphJson(
  graphDocument: GovernanceGraphDocument
): string {
  return `${JSON.stringify(graphDocument, null, 2)}\n`;
}

export function renderGovernanceGraphHtml(
  graphDocument: GovernanceGraphDocument
): string {
  return renderGovernanceGraphViewerHtml(graphDocument);
}

function normalizeFormat(
  format: GovernanceGraphExecutorOptions['format']
): GovernanceGraphFormat | null {
  if (!format) {
    return 'html';
  }

  if (format === 'json' || format === 'html') {
    return format;
  }

  return null;
}

function resolveOutputPath(
  format: GovernanceGraphFormat,
  outputPath: string | undefined
): string {
  if (outputPath) {
    return resolve(workspaceRoot, outputPath);
  }

  return resolve(
    workspaceRoot,
    format === 'json'
      ? 'dist/governance/graph.json'
      : 'dist/governance/graph.html'
  );
}

import { logger, workspaceRoot } from '@nx/devkit';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

import type { GovernanceGraphDocument } from '../../graph-document/contracts.js';
import { buildGovernanceGraphDocument } from '../../graph-document/index.js';
import { buildGovernanceAssessmentArtifacts } from '../../plugin/run-governance.js';
import type { GovernanceAssessmentArtifacts } from '../../plugin/build-assessment-artifacts.js';
import type { GovernanceGraphExecutorOptions } from '../types.js';

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
  const payload = JSON.stringify(graphDocument, null, 2).replace(
    /</g,
    '\\u003c'
  );

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <title>Governance Graph</title>',
    '  <style>',
    '    :root { color-scheme: light; font-family: Inter, system-ui, sans-serif; }',
    '    body { margin: 0; padding: 32px; background: #f8fafc; color: #0f172a; }',
    '    main { max-width: 1080px; margin: 0 auto; }',
    '    h1 { margin: 0 0 8px; font-size: 28px; }',
    '    p { margin: 0 0 24px; color: #475569; }',
    '    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 24px; }',
    '    .metric { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; }',
    '    .metric strong { display: block; font-size: 22px; }',
    '    .lists { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }',
    '    .panel { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; }',
    '    ul { margin: 12px 0 0; padding-left: 20px; }',
    '    code { font-family: ui-monospace, SFMono-Regular, monospace; }',
    '    @media (max-width: 800px) { .summary, .lists { grid-template-columns: 1fr; } }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main>',
    '    <h1>Governance Graph</h1>',
    `    <p>Workspace: ${escapeHtml(
      graphDocument.workspace?.name ?? 'workspace'
    )}</p>`,
    '    <section class="summary" aria-label="Graph summary">',
    `      <div class="metric"><span>Nodes</span><strong>${graphDocument.summary.nodeCount}</strong></div>`,
    `      <div class="metric"><span>Edges</span><strong>${graphDocument.summary.edgeCount}</strong></div>`,
    `      <div class="metric"><span>Findings</span><strong>${graphDocument.summary.findingCount}</strong></div>`,
    `      <div class="metric"><span>Critical nodes</span><strong>${graphDocument.summary.criticalNodeCount}</strong></div>`,
    '    </section>',
    '    <section class="lists">',
    '      <div class="panel">',
    '        <h2>Nodes</h2>',
    '        <ul id="node-list"></ul>',
    '      </div>',
    '      <div class="panel">',
    '        <h2>Edges</h2>',
    '        <ul id="edge-list"></ul>',
    '      </div>',
    '    </section>',
    '    <script id="governance-graph-data" type="application/json">',
    payload,
    '    </script>',
    '    <script>',
    '      const payloadElement = document.getElementById("governance-graph-data");',
    '      const graph = payloadElement ? JSON.parse(payloadElement.textContent || "{}") : { nodes: [], edges: [] };',
    '      const nodeList = document.getElementById("node-list");',
    '      const edgeList = document.getElementById("edge-list");',
    '      for (const node of graph.nodes || []) {',
    '        const item = document.createElement("li");',
    '        item.textContent = `${node.label} [${node.health}]`; ',
    '        nodeList?.appendChild(item);',
    '      }',
    '      for (const edge of graph.edges || []) {',
    '        const item = document.createElement("li");',
    '        item.textContent = `${edge.source} -> ${edge.target} [${edge.health}]`;',
    '        edgeList?.appendChild(item);',
    '      }',
    '    </script>',
    '  </main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

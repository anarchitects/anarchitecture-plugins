import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { GovernanceAssessmentArtifacts } from '../../plugin/build-assessment-artifacts.js';
import type { GovernanceGraphDocument } from '../../graph-document/contracts.js';
import {
  renderGovernanceGraphHtml,
  renderGovernanceGraphJson,
  runGovernanceGraphExecutor,
} from './executor.js';

describe('governance-graph executor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('schema accepts json and html formats', () => {
    const schema = JSON.parse(
      readFileSync(path.join(__dirname, 'schema.json'), 'utf8')
    ) as { properties: { format: { enum: string[] } } };

    expect(schema.properties.format.enum).toEqual(['json', 'html']);
  });

  it('renders pretty graph json output', () => {
    const rendered = renderGovernanceGraphJson(createGraphDocument());

    expect(rendered).toContain('"nodes": [');
    expect(rendered).toContain('"edges": [');
    expect(rendered).toContain('"summary": {');
    expect(rendered.endsWith('\n')).toBe(true);
  });

  it('renders static html with safely embedded payload and summary counts', () => {
    const rendered = renderGovernanceGraphHtml(
      createGraphDocument({
        workspace: { name: 'workspace<script>' },
        nodes: [
          {
            id: 'project-<unsafe>',
            label: 'project-<unsafe>',
            type: 'library',
            tags: [],
            health: 'warning',
            score: 70,
            badges: [],
            findings: [],
          },
        ],
      })
    );

    expect(rendered).toContain('<title>Governance Graph</title>');
    expect(rendered).toContain(
      '<script id="governance-graph-data" type="application/json">'
    );
    expect(rendered).toContain('\\u003cunsafe>');
    expect(rendered).toContain('Workspace: workspace&lt;script&gt;');
    expect(rendered).toContain('<span>Nodes</span><strong>1</strong>');
  });

  it('writes graph document json output', async () => {
    const ensureDirectory = jest.fn().mockResolvedValue(undefined);
    const writeOutput = jest.fn().mockResolvedValue(undefined);
    const info = jest.fn();
    const error = jest.fn();

    const result = await runGovernanceGraphExecutor(
      {
        format: 'json',
        outputPath: 'tmp/governance/nested/graph.json',
      },
      {
        buildArtifacts: jest.fn().mockResolvedValue(createArtifacts()),
        buildDocument: jest.fn().mockReturnValue(createGraphDocument()),
        ensureDirectory,
        writeOutput,
        info,
        error,
      }
    );

    expect(result).toEqual({ success: true });
    expect(ensureDirectory).toHaveBeenCalledTimes(1);
    expect(writeOutput).toHaveBeenCalledTimes(1);
    expect(writeOutput.mock.calls[0][0]).toMatch(
      /tmp\/governance\/nested\/graph\.json$/
    );
    expect(writeOutput.mock.calls[0][1]).toContain('"nodes": [');
    expect(writeOutput.mock.calls[0][1]).toContain('"summary": {');
    expect(error).not.toHaveBeenCalled();
  });

  it('writes static html output', async () => {
    const ensureDirectory = jest.fn().mockResolvedValue(undefined);
    const writeOutput = jest.fn().mockResolvedValue(undefined);

    const result = await runGovernanceGraphExecutor(
      {
        format: 'html',
        outputPath: 'tmp/governance/graph.html',
      },
      {
        buildArtifacts: jest.fn().mockResolvedValue(createArtifacts()),
        buildDocument: jest.fn().mockReturnValue(createGraphDocument()),
        ensureDirectory,
        writeOutput,
        info: jest.fn(),
        error: jest.fn(),
      }
    );

    expect(result).toEqual({ success: true });
    expect(writeOutput.mock.calls[0][1]).toContain('<!doctype html>');
    expect(writeOutput.mock.calls[0][1]).toContain('governance-graph-data');
    expect(writeOutput.mock.calls[0][1]).toContain('Nodes');
  });

  it('fails deterministically for unsupported format', async () => {
    const error = jest.fn();

    const result = await runGovernanceGraphExecutor(
      {
        format: 'svg' as 'json',
      },
      {
        buildArtifacts: jest.fn(),
        buildDocument: jest.fn(),
        ensureDirectory: jest.fn(),
        writeOutput: jest.fn(),
        info: jest.fn(),
        error,
      }
    );

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith(
      'Unsupported governance graph format: svg.'
    );
  });

  it('is registered in the plugin executor config', () => {
    const config = JSON.parse(
      readFileSync(path.join(__dirname, '..', '..', 'index.json'), 'utf8')
    ) as {
      executors: Record<string, { implementation: string; schema: string }>;
    };

    expect(config.executors['governance-graph']).toEqual({
      implementation: './executors/governance-graph/executor',
      schema: './executors/governance-graph/schema.json',
    });
  });
});

function createArtifacts(): GovernanceAssessmentArtifacts {
  return {
    assessment: {
      workspace: {
        id: 'workspace',
        name: 'workspace',
        root: '.',
        projects: [],
        dependencies: [],
      },
      profile: 'frontend-layered',
      warnings: [],
      exceptions: {
        summary: {
          declaredCount: 0,
          matchedCount: 0,
          suppressedPolicyViolationCount: 0,
          suppressedConformanceFindingCount: 0,
          unusedExceptionCount: 0,
          activeExceptionCount: 0,
          staleExceptionCount: 0,
          expiredExceptionCount: 0,
          reactivatedPolicyViolationCount: 0,
          reactivatedConformanceFindingCount: 0,
        },
        used: [],
        unused: [],
        suppressedFindings: [],
        reactivatedFindings: [],
      },
      violations: [],
      measurements: [],
      signalBreakdown: {
        total: 0,
        bySource: [],
        byType: [],
        bySeverity: [],
      },
      metricBreakdown: {
        families: [],
      },
      topIssues: [],
      health: {
        score: 100,
        status: 'good',
        grade: 'A',
        hotspots: [],
        metricHotspots: [],
        projectHotspots: [],
        explainability: {
          summary: 'Healthy workspace.',
          statusReason: 'No issues.',
          weakestMetrics: [],
          dominantIssues: [],
        },
      },
      recommendations: [],
    },
    signals: [],
    exceptionApplication: {
      declaredExceptions: [],
      exceptionStatuses: {},
      policyViolations: [],
      conformanceFindings: [],
      activePolicyViolations: [],
      suppressedPolicyViolations: [],
      reactivatedPolicyViolations: [],
      activeConformanceFindings: [],
      suppressedConformanceFindings: [],
      reactivatedConformanceFindings: [],
    },
  };
}

function createGraphDocument(
  overrides: Partial<GovernanceGraphDocument> = {}
): GovernanceGraphDocument {
  return {
    schemaVersion: '1.0',
    workspace: {
      name: 'workspace',
      ...(overrides.workspace ?? {}),
    },
    summary: {
      nodeCount: overrides.nodes?.length ?? 1,
      edgeCount: overrides.edges?.length ?? 1,
      findingCount: 0,
      healthyNodeCount: 1,
      warningNodeCount: 0,
      criticalNodeCount: 0,
      unknownNodeCount: 0,
      healthyEdgeCount: 1,
      warningEdgeCount: 0,
      criticalEdgeCount: 0,
      unknownEdgeCount: 0,
    },
    nodes: overrides.nodes ?? [
      {
        id: 'orders-app',
        label: 'orders-app',
        type: 'application',
        tags: ['domain:orders'],
        health: 'healthy',
        score: 100,
        badges: [],
        findings: [],
      },
    ],
    edges: overrides.edges ?? [
      {
        id: 'orders-app->shared-util->static',
        source: 'orders-app',
        target: 'shared-util',
        type: 'static',
        health: 'healthy',
        score: 100,
        findings: [],
      },
    ],
    facets: {
      health: ['healthy'],
      tags: ['domain:orders'],
      owners: [],
      findingSources: [],
      findingSeverities: [],
      ruleIds: [],
    },
    ...overrides,
  };
}

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { CreateNodesContextV2, CreateNodesResultV2 } from '@nx/devkit';

import { exportAiHandoffArtifacts } from '../ai-handoff/index.js';
import { createNodesV2 } from '../plugin/index.js';
import { runGovernanceGraphExecutor } from '../executors/governance-graph/executor.js';
import {
  GOVERNANCE_AI_HANDOFF_OUTPUT_DIR,
  GOVERNANCE_AI_HANDOFF_USE_CASES,
  GOVERNANCE_DEFAULT_METRIC_SCHEMA_VERSION,
  GOVERNANCE_DEFAULT_PROFILE_GLOB,
  GOVERNANCE_DEFAULT_PROFILE_NAME,
  GOVERNANCE_DEFAULT_SNAPSHOT_DIR,
  GOVERNANCE_EXECUTOR_IDS,
  GOVERNANCE_GENERATOR_IDS,
  GOVERNANCE_GRAPH_DEFAULT_HTML_OUTPUT_PATH,
  GOVERNANCE_GRAPH_DEFAULT_JSON_OUTPUT_PATH,
  GOVERNANCE_INFERRED_TARGET_NAMES,
  GOVERNANCE_PACKAGE_PUBLIC_ENTRYPOINTS,
} from './public-workflows.js';

describe('governance public workflow compatibility inventory', () => {
  const governanceRoot = path.resolve(__dirname, '..', '..');
  const sourceRoot = path.join(governanceRoot, 'src');
  const packageManifest = JSON.parse(
    readFileSync(path.join(governanceRoot, 'package.json'), 'utf8')
  ) as {
    main: string;
    executors: string;
    generators: string;
    nx: { plugins: Array<{ plugin: string }> };
  };
  const pluginConfig = JSON.parse(
    readFileSync(path.join(sourceRoot, 'index.json'), 'utf8')
  ) as {
    executors: Record<string, { implementation: string; schema: string }>;
    generators: Record<string, { implementation: string; schema: string }>;
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the host package public entrypoints stable', () => {
    expect(packageManifest.main).toBe(
      GOVERNANCE_PACKAGE_PUBLIC_ENTRYPOINTS.main
    );
    expect(packageManifest.executors).toBe(
      GOVERNANCE_PACKAGE_PUBLIC_ENTRYPOINTS.executors
    );
    expect(packageManifest.generators).toBe(
      GOVERNANCE_PACKAGE_PUBLIC_ENTRYPOINTS.generators
    );
    expect(packageManifest.nx.plugins).toEqual([
      { plugin: GOVERNANCE_PACKAGE_PUBLIC_ENTRYPOINTS.plugin },
    ]);
    expect(packageManifest).not.toHaveProperty('bin');
  });

  it('keeps public executor ids, implementation paths, and schemas stable', () => {
    expect(Object.keys(pluginConfig.executors)).toEqual([
      ...GOVERNANCE_EXECUTOR_IDS,
    ]);

    for (const executorId of GOVERNANCE_EXECUTOR_IDS) {
      expect(pluginConfig.executors[executorId]).toEqual({
        implementation: `./executors/${executorId}/executor`,
        schema: `./executors/${executorId}/schema.json`,
      });
      expect(
        existsSync(
          path.join(sourceRoot, 'executors', executorId, 'executor.ts')
        )
      ).toBe(true);
      expect(
        existsSync(
          path.join(sourceRoot, 'executors', executorId, 'schema.json')
        )
      ).toBe(true);
    }
  });

  it('keeps public generator ids, implementation paths, and schemas stable', () => {
    expect(Object.keys(pluginConfig.generators)).toEqual([
      ...GOVERNANCE_GENERATOR_IDS,
    ]);

    for (const generatorId of GOVERNANCE_GENERATOR_IDS) {
      expect(pluginConfig.generators[generatorId]).toEqual({
        implementation: `./generators/${generatorId}/generator`,
        schema: `./generators/${generatorId}/schema.json`,
      });
      expect(
        existsSync(
          path.join(sourceRoot, 'generators', generatorId, 'generator.ts')
        )
      ).toBe(true);
      expect(
        existsSync(
          path.join(sourceRoot, 'generators', generatorId, 'schema.json')
        )
      ).toBe(true);
    }
  });

  it('keeps split-sensitive executor and generator schema defaults stable', () => {
    const snapshotSchema = readJson(
      path.join(sourceRoot, 'executors', 'repo-snapshot', 'schema.json')
    ) as {
      properties: {
        profile: { default: string };
        output: { default: string; enum: string[] };
        snapshotDir: { default: string };
        metricSchemaVersion: { default: string };
      };
      additionalProperties: boolean;
    };
    const graphSchema = readJson(
      path.join(sourceRoot, 'executors', 'governance-graph', 'schema.json')
    ) as {
      properties: {
        profile: { default: string };
        format: { default: string; enum: string[] };
      };
      additionalProperties: boolean;
    };
    const initSchema = readJson(
      path.join(sourceRoot, 'generators', 'init', 'schema.json')
    ) as {
      properties: {
        targetPreset: { default: string; enum: string[] };
        preset: { default: string[] };
      };
    };
    const eslintSchema = readJson(
      path.join(sourceRoot, 'generators', 'eslint-integration', 'schema.json')
    ) as {
      properties: {
        governanceHelperPath: { default: string };
      };
      additionalProperties: boolean;
    };

    expect(snapshotSchema.properties.profile.default).toBe(
      GOVERNANCE_DEFAULT_PROFILE_NAME
    );
    expect(snapshotSchema.properties.output).toMatchObject({
      default: 'cli',
      enum: ['cli', 'json'],
    });
    expect(snapshotSchema.properties.snapshotDir.default).toBe(
      GOVERNANCE_DEFAULT_SNAPSHOT_DIR
    );
    expect(snapshotSchema.properties.metricSchemaVersion.default).toBe(
      GOVERNANCE_DEFAULT_METRIC_SCHEMA_VERSION
    );
    expect(snapshotSchema.additionalProperties).toBe(false);

    expect(graphSchema.properties.profile.default).toBe(
      GOVERNANCE_DEFAULT_PROFILE_NAME
    );
    expect(graphSchema.properties.format).toMatchObject({
      default: 'html',
      enum: ['json', 'html'],
    });
    expect(graphSchema.additionalProperties).toBe(false);

    expect(initSchema.properties.targetPreset).toMatchObject({
      default: 'minimal',
      enum: ['minimal', 'full'],
    });
    expect(initSchema.properties.preset.default).toEqual([
      GOVERNANCE_DEFAULT_PROFILE_NAME,
    ]);
    expect(eslintSchema.properties.governanceHelperPath.default).toBe(
      'tools/governance/eslint/dependency-constraints.mjs'
    );
    expect(eslintSchema.additionalProperties).toBe(false);
  });

  it('keeps Project Crystal profile discovery and inferred target names stable', async () => {
    const createNodes = createNodesV2[1];
    const context: CreateNodesContextV2 = {
      workspaceRoot: '/workspace',
      nxJsonConfiguration: {} as CreateNodesContextV2['nxJsonConfiguration'],
    };

    expect(createNodesV2[0]).toBe(GOVERNANCE_DEFAULT_PROFILE_GLOB);

    const results = await createNodes(
      ['tools/governance/profiles/frontend-layered.json'],
      undefined,
      context
    );

    expect(Object.keys(collectTargets(results))).toEqual([
      ...GOVERNANCE_INFERRED_TARGET_NAMES,
    ]);
  });

  it('keeps governance graph default output paths stable for html and json formats', async () => {
    const ensureDirectory = jest.fn().mockResolvedValue(undefined);
    const writeOutput = jest.fn().mockResolvedValue(undefined);

    await runGovernanceGraphExecutor(
      {},
      {
        buildArtifacts: jest.fn().mockResolvedValue(createArtifacts()),
        buildDocument: jest.fn().mockReturnValue(createGraphDocument()),
        ensureDirectory,
        writeOutput,
        info: jest.fn(),
        error: jest.fn(),
      }
    );
    await runGovernanceGraphExecutor(
      { format: 'json' },
      {
        buildArtifacts: jest.fn().mockResolvedValue(createArtifacts()),
        buildDocument: jest.fn().mockReturnValue(createGraphDocument()),
        ensureDirectory,
        writeOutput,
        info: jest.fn(),
        error: jest.fn(),
      }
    );

    expect(writeOutput.mock.calls[0][0]).toMatch(
      new RegExp(
        `${escapeRegExp(path.sep + GOVERNANCE_GRAPH_DEFAULT_HTML_OUTPUT_PATH)}$`
      )
    );
    expect(writeOutput.mock.calls[1][0]).toMatch(
      new RegExp(
        `${escapeRegExp(path.sep + GOVERNANCE_GRAPH_DEFAULT_JSON_OUTPUT_PATH)}$`
      )
    );
  });

  it('keeps AI handoff artifact output paths stable for every supported use case', () => {
    const workspaceRoot = mkdtempSync(
      path.join(tmpdir(), 'nx-governance-compat-ai-')
    );

    try {
      for (const useCase of GOVERNANCE_AI_HANDOFF_USE_CASES) {
        const artifacts = exportAiHandoffArtifacts({
          workspaceRoot,
          useCase,
          payload: {
            useCase,
            request: { kind: useCase },
            analysis: {
              kind: useCase,
              summary: `${useCase} summary`,
              findings: [],
              recommendations: [],
            },
          },
        });

        expect(artifacts.payloadRelativePath).toBe(
          `${GOVERNANCE_AI_HANDOFF_OUTPUT_DIR}/${useCase}.payload.json`
        );
        expect(artifacts.promptRelativePath).toBe(
          `${GOVERNANCE_AI_HANDOFF_OUTPUT_DIR}/${useCase}.prompt.md`
        );
      }
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function collectTargets(
  results: CreateNodesResultV2
): Record<string, Record<string, unknown>> {
  const collected: Record<string, Record<string, unknown>> = {};

  for (const [, result] of results) {
    const targets = result.projects?.['.']?.targets ?? {};

    for (const [targetName, targetConfig] of Object.entries(targets)) {
      collected[targetName] = targetConfig as Record<string, unknown>;
    }
  }

  return collected;
}

function createArtifacts() {
  return {
    assessment: {
      workspace: {
        id: 'workspace',
        name: 'workspace',
        root: '.',
        projects: [],
        dependencies: [],
      },
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
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
    extensionDiagnostics: [],
  };
}

function createGraphDocument() {
  return {
    schemaVersion: '1.0',
    workspace: { name: 'workspace' },
    summary: {
      nodeCount: 1,
      edgeCount: 0,
      findingCount: 0,
      healthyNodeCount: 1,
      warningNodeCount: 0,
      criticalNodeCount: 0,
      unknownNodeCount: 0,
      healthyEdgeCount: 0,
      warningEdgeCount: 0,
      criticalEdgeCount: 0,
      unknownEdgeCount: 0,
    },
    nodes: [
      {
        id: 'booking-ui',
        label: 'booking-ui',
        type: 'library',
        tags: ['scope:booking'],
        health: 'healthy',
        score: 100,
        badges: [],
        findings: [],
      },
    ],
    edges: [],
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

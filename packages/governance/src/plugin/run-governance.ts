import { logger, workspaceRoot } from '@nx/devkit';
import {
  AiAnalysisRequest,
  AiAnalysisResult,
  buildAiDriftHandoffPayload,
  buildAiManagementInsightsHandoffPayload,
  buildAiPrImpactHandoffPayload,
  buildAiRootCauseHandoffPayload,
  buildAiScorecardHandoffPayload,
  buildArchitectureRecommendationsRequest,
  buildCognitiveLoadRequest,
  buildCognitiveLoadContext,
  buildGovernancePayloadTruncationMetadata,
  buildGovernanceAssessment,
  buildDeliveryImpactAssessment,
  buildDriftSummary,
  buildSnapshotDeliveryImpactSummary,
  buildOnboardingContext,
  buildPersistentSmellSignals,
  buildPrImpactContext,
  buildManagementInsightsAiRequest,
  buildRecommendationsTrendContext,
  buildRefactoringSuggestionsContext,
  buildScopedDriftRequest,
  buildScopedRootCauseRequest,
  buildScopedScorecardRequest,
  buildOnboardingRequest,
  buildPrImpactRequest,
  buildRefactoringSuggestionsRequest,
  buildRootCauseRequest,
  buildScorecardRequest,
  buildSmellClustersRequest,
  compareSnapshots,
  DeliveryImpactAssessment,
  DriftSignal,
  DriftSummary,
  GovernanceAssessment,
  GovernanceNode,
  GovernanceProfile,
  GovernanceRelation,
  MetricSnapshot,
  rankTopViolations,
  SnapshotComparison,
  summarizeArchitectureRecommendations,
  summarizeCognitiveLoad,
  summarizeManagementInsights,
  summarizeOnboarding,
  summarizePrImpact,
  summarizeRefactoringSuggestions,
  summarizeRootCause,
  summarizeScorecard,
  summarizeSmellClusters,
  summarizeDriftInterpretation,
  summarizeDrift,
  scopeGovernanceRelations,
} from '@anarchitects/governance-core';

import {
  loadProfileOverrides,
  resolveBuiltInGovernanceProfile,
} from '../presets/frontend-layered/profile.js';
import { GOVERNANCE_DEFAULT_PROFILE_NAME } from '../profile/runtime-profile.js';
import { renderCliReport } from '../reporting/render-cli.js';
import { renderJsonReport } from '../reporting/render-json.js';
import { renderManagementReport } from '../reporting/render-management-report.js';
import {
  listMetricSnapshots,
  readMetricSnapshot,
  saveMetricSnapshot,
} from '../snapshot-store/index.js';
import { readConformanceSnapshot } from '../conformance-adapter/conformance-adapter.js';
import path from 'node:path';
import {
  buildManagementInsightsPrompt,
  exportAiHandoffArtifacts,
} from '../ai-handoff/index.js';
import { resolveConformanceInput } from './resolve-conformance-input.js';
import { readChangedFiles } from './pr-impact-host-context.js';
import {
  renderAiCognitiveLoadCliReport,
  renderAiDriftCliReport,
  renderAiOnboardingCliReport,
  renderAiPrImpactCliReport,
  renderAiRecommendationsCliReport,
  renderAiRefactoringSuggestionsCliReport,
  renderAiRootCauseCliReport,
  renderAiScorecardCliReport,
  renderAiSmellClustersCliReport,
  renderDriftCliReport,
} from './governance-run-renderers.js';
import {
  resolveOptionalSnapshotComparison,
  resolveSnapshotPath,
} from './snapshot-runtime.js';
import type { GovernanceAssessmentArtifacts } from './build-assessment-artifacts.js';
import type {
  ConformanceFinding,
  ConformanceSnapshot,
} from '../conformance-adapter/conformance-adapter.js';
import { AI_PAYLOAD_LIMITS } from './ai-payload-limits.js';
import {
  composeNxGovernanceRuntime,
  type RuntimeGovernanceNode,
  type RuntimeGovernanceRelation,
  type RuntimeGovernanceWorkspace,
} from './compose-governance-runtime.js';

export interface GovernanceRunOptions {
  profile?: string;
  output?: 'cli' | 'json';
  failOnViolation?: boolean;
  conformanceJson?: string;
  reportType?: 'health' | 'boundaries' | 'ownership' | 'architecture';
}

export interface GovernanceRunResult {
  assessment: GovernanceAssessment;
  rendered: string;
  success: boolean;
}

export interface GovernanceSnapshotRunOptions extends GovernanceRunOptions {
  snapshotDir?: string;
  metricSchemaVersion?: string;
}

export interface GovernanceSnapshotRunResult extends GovernanceRunResult {
  snapshot: MetricSnapshot;
  snapshotPath: string;
}

export interface GovernanceDriftRunOptions extends GovernanceRunOptions {
  snapshotDir?: string;
  baseline?: string;
  current?: string;
  driftThreshold?: number;
}

export interface GovernanceDriftRunResult {
  comparison: SnapshotComparison | null;
  signals: DriftSignal[];
  summary: DriftSummary;
  rendered: string;
  success: boolean;
}

export interface GovernanceManagementInsightsRunOptions
  extends Pick<GovernanceRunOptions, 'profile' | 'output' | 'failOnViolation'> {
  snapshotDir?: string;
  baseline?: string;
  current?: string;
}

export interface GovernanceManagementInsightsRunResult {
  assessment: GovernanceAssessment;
  deliveryImpact: DeliveryImpactAssessment;
  comparison?: SnapshotComparison;
  rendered: string;
  success: boolean;
}

export type GovernanceAiManagementInsightsRunOptions =
  GovernanceManagementInsightsRunOptions;

export interface GovernanceAiManagementInsightsRunResult {
  assessment: GovernanceAssessment;
  deliveryImpact: DeliveryImpactAssessment;
  comparison?: SnapshotComparison;
  request: AiAnalysisRequest;
  analysis: AiAnalysisResult;
  handoffPayloadPath: string;
  handoffPromptPath: string;
  rendered: string;
  success: boolean;
}

export interface GovernanceAiRootCauseRunOptions extends GovernanceRunOptions {
  snapshotDir?: string;
  snapshotPath?: string;
  topViolations?: number;
}

export interface GovernanceAiRootCauseRunResult {
  request: AiAnalysisRequest;
  analysis: AiAnalysisResult;
  snapshotPath: string;
  handoffPayloadPath: string;
  handoffPromptPath: string;
  rendered: string;
  success: boolean;
}

export interface GovernanceAiPrImpactRunOptions extends GovernanceRunOptions {
  baseRef?: string;
  headRef?: string;
}

export interface GovernanceAiDriftRunOptions extends GovernanceRunOptions {
  snapshotDir?: string;
  baseline?: string;
  current?: string;
  driftThreshold?: number;
}

export interface GovernanceAiDriftRunResult {
  request: AiAnalysisRequest;
  analysis: AiAnalysisResult;
  comparison: SnapshotComparison | null;
  signals: DriftSignal[];
  summary: DriftSummary;
  handoffPayloadPath: string;
  handoffPromptPath: string;
  rendered: string;
  success: boolean;
}

export interface GovernanceAiPrImpactRunResult {
  request: AiAnalysisRequest;
  analysis: AiAnalysisResult;
  handoffPayloadPath: string;
  handoffPromptPath: string;
  rendered: string;
  success: boolean;
}

export interface GovernanceAiCognitiveLoadRunOptions
  extends GovernanceRunOptions {
  project?: string;
  domain?: string;
  topProjects?: number;
}

export interface GovernanceAiCognitiveLoadRunResult {
  request: AiAnalysisRequest;
  analysis: AiAnalysisResult;
  rendered: string;
  success: boolean;
}

export interface GovernanceAiRecommendationsRunOptions
  extends GovernanceRunOptions {
  snapshotDir?: string;
  topViolations?: number;
}

export interface GovernanceAiSmellClustersRunOptions
  extends GovernanceRunOptions {
  snapshotDir?: string;
  topViolations?: number;
}

export interface GovernanceAiRefactoringSuggestionsRunOptions
  extends GovernanceRunOptions {
  snapshotDir?: string;
  topViolations?: number;
  topProjects?: number;
}

export interface GovernanceAiScorecardRunOptions extends GovernanceRunOptions {
  snapshotDir?: string;
  snapshotPath?: string;
}

export interface GovernanceAiOnboardingRunOptions extends GovernanceRunOptions {
  topViolations?: number;
  topProjects?: number;
}

export interface GovernanceAiRecommendationsRunResult {
  request: AiAnalysisRequest;
  analysis: AiAnalysisResult;
  rendered: string;
  success: boolean;
}

export interface GovernanceAiSmellClustersRunResult {
  request: AiAnalysisRequest;
  analysis: AiAnalysisResult;
  rendered: string;
  success: boolean;
}

export interface GovernanceAiRefactoringSuggestionsRunResult {
  request: AiAnalysisRequest;
  analysis: AiAnalysisResult;
  rendered: string;
  success: boolean;
}

export interface GovernanceAiScorecardRunResult {
  request: AiAnalysisRequest;
  analysis: AiAnalysisResult;
  handoffPayloadPath: string;
  handoffPromptPath: string;
  rendered: string;
  success: boolean;
}

export interface GovernanceAiOnboardingRunResult {
  request: AiAnalysisRequest;
  analysis: AiAnalysisResult;
  rendered: string;
  success: boolean;
}

interface GovernanceAssessmentArtifactsOptions {
  asOf?: Date;
}

export async function runGovernance(
  options: GovernanceRunOptions = {}
): Promise<GovernanceRunResult> {
  const artifacts = await buildAssessmentArtifacts(options);
  const { assessment } = artifacts;
  const output = options.output ?? resolveProfileConfiguredOutput(artifacts);

  const rendered =
    output === 'json'
      ? renderJsonReport(artifacts)
      : renderCliReport(artifacts);

  if (output === 'json') {
    process.stdout.write(`${rendered}\n`);
  } else {
    logger.info(rendered);
  }

  const success =
    !options.failOnViolation || (assessment.violations?.length ?? 0) === 0;

  return {
    assessment,
    rendered,
    success,
  };
}

export async function runGovernanceSnapshot(
  options: GovernanceSnapshotRunOptions = {}
): Promise<GovernanceSnapshotRunResult> {
  const { assessment } = await buildAssessmentArtifacts({
    ...options,
    reportType: 'health',
  });
  const deliveryImpact = buildDeliveryImpactAssessment({
    assessment,
  });

  const persisted = await saveMetricSnapshot({
    assessment,
    snapshotDir: options.snapshotDir,
    metricSchemaVersion: options.metricSchemaVersion,
    deliveryImpact: buildSnapshotDeliveryImpactSummary(deliveryImpact),
  });

  const rendered =
    options.output === 'json'
      ? JSON.stringify(
          {
            snapshotPath: persisted.relativePath,
            snapshot: persisted.snapshot,
          },
          null,
          2
        )
      : `Snapshot saved at ${persisted.relativePath}`;

  if (options.output === 'json') {
    process.stdout.write(`${rendered}\n`);
  } else {
    logger.info(rendered);
  }

  const success =
    !options.failOnViolation || (assessment.violations?.length ?? 0) === 0;

  return {
    assessment,
    rendered,
    success,
    snapshot: persisted.snapshot,
    snapshotPath: persisted.relativePath,
  };
}

export async function runGovernanceDrift(
  options: GovernanceDriftRunOptions = {}
): Promise<GovernanceDriftRunResult> {
  const snapshotPaths = await listMetricSnapshots(options.snapshotDir);
  const emptySummary = buildDriftSummary([]);
  const baselinePath = resolveSnapshotPath(
    options.baseline,
    snapshotPaths.at(-2)
  );
  const currentPath = resolveSnapshotPath(
    options.current,
    snapshotPaths.at(-1)
  );

  if (!baselinePath || !currentPath) {
    const rendered =
      options.output === 'json'
        ? JSON.stringify(
            {
              error:
                'At least two snapshots are required. Run nx repo-snapshot multiple times first.',
            },
            null,
            2
          )
        : 'At least two snapshots are required. Run nx repo-snapshot multiple times first.';

    if (options.output === 'json') {
      process.stdout.write(`${rendered}\n`);
    } else {
      logger.info(rendered);
    }

    return {
      comparison: null,
      signals: [],
      summary: emptySummary,
      rendered,
      success: false,
    };
  }

  const baseline = await readMetricSnapshot(baselinePath);
  const current = await readMetricSnapshot(currentPath);
  const comparison = compareSnapshots(baseline, current);
  const signals = summarizeDrift(comparison, options.driftThreshold ?? 0.02);
  const summary = buildDriftSummary(signals);

  const rendered =
    options.output === 'json'
      ? JSON.stringify({ comparison, signals, summary }, null, 2)
      : renderDriftCliReport(comparison, signals, summary);

  if (options.output === 'json') {
    process.stdout.write(`${rendered}\n`);
  } else {
    logger.info(rendered);
  }

  return {
    comparison,
    signals,
    summary,
    rendered,
    success: true,
  };
}

export async function runGovernanceManagementInsights(
  options: GovernanceManagementInsightsRunOptions = {}
): Promise<GovernanceManagementInsightsRunResult> {
  const { assessment } = await buildAssessmentArtifacts({
    profile: options.profile,
    output: options.output,
    failOnViolation: options.failOnViolation,
    reportType: 'health',
  });
  const comparison = await resolveOptionalSnapshotComparison(options);
  const deliveryImpact = buildDeliveryImpactAssessment({
    assessment,
    comparison,
  });

  const rendered =
    options.output === 'json'
      ? JSON.stringify(deliveryImpact, null, 2)
      : renderManagementReport(deliveryImpact);

  if (options.output === 'json') {
    process.stdout.write(`${rendered}\n`);
  } else {
    logger.info(rendered);
  }

  const success =
    !options.failOnViolation || (assessment.violations?.length ?? 0) === 0;

  return {
    assessment,
    deliveryImpact,
    comparison,
    rendered,
    success,
  };
}

export async function runGovernanceAiManagementInsights(
  options: GovernanceAiManagementInsightsRunOptions = {}
): Promise<GovernanceAiManagementInsightsRunResult> {
  const { assessment } = await buildAssessmentArtifacts({
    profile: options.profile,
    output: options.output,
    failOnViolation: options.failOnViolation,
    reportType: 'health',
  });
  const comparison = await resolveOptionalSnapshotComparison(options);
  const deliveryImpact = buildDeliveryImpactAssessment({
    assessment,
    comparison,
  });
  const request = buildManagementInsightsAiRequest({
    deliveryImpact,
    assessment,
    comparison,
    profile: options.profile ?? assessment.profile,
    metadata: {
      comparisonAvailable: Boolean(comparison),
    },
  });
  const analysis = summarizeManagementInsights(request);
  const handoffArtifacts = exportAiHandoffArtifacts({
    workspaceRoot,
    useCase: 'management-insights',
    payload: buildAiManagementInsightsHandoffPayload({
      request,
      analysis,
      metadata: {
        profile: request.profile,
      },
    }),
    prompt: buildManagementInsightsPrompt({ request }),
  });

  const rendered =
    options.output === 'json'
      ? JSON.stringify({ request, analysis, deliveryImpact }, null, 2)
      : renderManagementReport(deliveryImpact);

  if (options.output === 'json') {
    process.stdout.write(`${rendered}\n`);
  } else {
    logger.info(rendered);
  }

  process.stderr.write(`${handoffArtifacts.instructions}\n`);

  const success =
    !options.failOnViolation || (assessment.violations?.length ?? 0) === 0;

  return {
    assessment,
    deliveryImpact,
    comparison,
    request,
    analysis,
    handoffPayloadPath: handoffArtifacts.payloadRelativePath,
    handoffPromptPath: handoffArtifacts.promptRelativePath,
    rendered,
    success,
  };
}

export async function runGovernanceAiRootCause(
  options: GovernanceAiRootCauseRunOptions = {}
): Promise<GovernanceAiRootCauseRunResult> {
  const { assessment } = await buildAssessmentArtifacts({
    ...options,
    reportType: 'health',
  });
  const workspace = readCanonicalWorkspace(assessment);
  const dependencyRelations = readDependencyRelations(workspace);

  const snapshotPaths = await listMetricSnapshots(options.snapshotDir);
  const resolvedSnapshotPath = resolveSnapshotPath(
    options.snapshotPath,
    snapshotPaths.at(-1)
  );

  const snapshotSource =
    resolvedSnapshotPath ||
    (
      await saveMetricSnapshot({
        assessment,
        snapshotDir: options.snapshotDir,
      })
    ).filePath;

  const snapshot = await readMetricSnapshot(snapshotSource);
  const topViolations = rankTopViolations(
    snapshot.violations,
    options.topViolations ?? 10
  );

  const request = buildRootCauseRequest({
    profile: options.profile ?? assessment.profile,
    snapshot,
    relations: dependencyRelations,
    topViolations,
    metadata: {
      snapshotPath: path.relative(workspaceRoot, snapshotSource),
      totalViolations: snapshot.violations.length,
      selectedViolations: topViolations.length,
    },
  });
  const analysis = summarizeRootCause(request);
  const {
    request: scopedRootCauseRequest,
    payloadScope: rootCausePayloadScope,
  } = buildScopedRootCauseRequest({
    request,
    relations: dependencyRelations,
    topViolations,
    relationLimit: AI_PAYLOAD_LIMITS.rootCauseDependencies,
    topViolationsLimit: options.topViolations ?? 10,
  });

  const handoffArtifacts = exportAiHandoffArtifacts({
    workspaceRoot,
    useCase: 'root-cause',
    payload: buildAiRootCauseHandoffPayload({
      request: scopedRootCauseRequest,
      analysis,
      payloadScope: {
        relations: rootCausePayloadScope.relations,
      },
      metadata: {
        snapshotPath: path.relative(workspaceRoot, snapshotSource),
      },
    }),
  });

  const relativeSnapshotPath = path.relative(workspaceRoot, snapshotSource);
  const rendered =
    options.output === 'json'
      ? JSON.stringify(
          {
            snapshotPath: relativeSnapshotPath,
            request,
            analysis,
          },
          null,
          2
        )
      : renderAiRootCauseCliReport(
          analysis,
          relativeSnapshotPath,
          topViolations.length
        );

  if (options.output === 'json') {
    process.stdout.write(`${rendered}\n`);
  } else {
    logger.info(rendered);
  }

  process.stderr.write(`${handoffArtifacts.instructions}\n`);

  const success =
    !options.failOnViolation || (assessment.violations?.length ?? 0) === 0;

  return {
    request,
    analysis,
    snapshotPath: relativeSnapshotPath,
    handoffPayloadPath: handoffArtifacts.payloadRelativePath,
    handoffPromptPath: handoffArtifacts.promptRelativePath,
    rendered,
    success,
  };
}

export async function runGovernanceAiPrImpact(
  options: GovernanceAiPrImpactRunOptions = {}
): Promise<GovernanceAiPrImpactRunResult> {
  const { assessment } = await buildAssessmentArtifacts({
    ...options,
    reportType: 'health',
  });
  const workspace = readCanonicalWorkspace(assessment);
  const projectNodes = readProjectNodes(workspace);
  const dependencyRelations = readDependencyRelations(workspace);

  const baseRef = options.baseRef ?? 'main';
  const headRef = options.headRef ?? 'HEAD';
  const changedFiles = readChangedFiles(baseRef, headRef);

  const affectedNodeIds = collectAffectedNodeIds(projectNodes, changedFiles);
  const { items: scopedRelations } = scopeGovernanceRelations(
    dependencyRelations,
    affectedNodeIds
  );
  const affectedRelationIds = collectAffectedRelationIds(
    workspace.relations,
    affectedNodeIds
  );
  const prImpactContext = buildPrImpactContext({
    affectedNodeIds: [...affectedNodeIds].sort((left, right) =>
      left.localeCompare(right)
    ),
    relations: dependencyRelations,
    nodes: projectNodes,
    changedFiles,
    changedFilesCount: changedFiles.length,
  });

  const request = buildPrImpactRequest({
    profile: options.profile ?? assessment.profile,
    affectedNodeIds: [...affectedNodeIds].sort((left, right) =>
      left.localeCompare(right)
    ),
    affectedRelationIds,
    relations: scopedRelations,
    metadata: {
      baseRef,
      headRef,
      changedFiles,
      ...prImpactContext,
    },
  });

  const analysis = summarizePrImpact(request);
  const prImpactRelationSlice = scopeGovernanceRelations(
    scopedRelations,
    affectedNodeIds,
    AI_PAYLOAD_LIMITS.prImpactDependencies
  );

  const scopedPrImpactRequest = {
    ...request,
    inputs: {
      ...request.inputs,
      relations: prImpactRelationSlice.items,
      metadata: {
        ...(request.inputs.metadata ?? {}),
        payloadScope: {
          relations: prImpactRelationSlice.truncation,
          affectedNodes: buildGovernancePayloadTruncationMetadata(
            affectedNodeIds.size,
            affectedNodeIds.size,
            affectedNodeIds.size
          ),
        },
      },
    },
  };

  const handoffArtifacts = exportAiHandoffArtifacts({
    workspaceRoot,
    useCase: 'pr-impact',
    payload: buildAiPrImpactHandoffPayload({
      request: scopedPrImpactRequest,
      analysis,
      payloadScope: {
        relations: prImpactRelationSlice.truncation,
      },
    }),
  });

  const rendered =
    options.output === 'json'
      ? JSON.stringify({ request, analysis }, null, 2)
      : renderAiPrImpactCliReport(analysis);

  if (options.output === 'json') {
    process.stdout.write(`${rendered}\n`);
  } else {
    logger.info(rendered);
  }

  process.stderr.write(`${handoffArtifacts.instructions}\n`);

  const success =
    !options.failOnViolation || (assessment.violations?.length ?? 0) === 0;

  return {
    request,
    analysis,
    handoffPayloadPath: handoffArtifacts.payloadRelativePath,
    handoffPromptPath: handoffArtifacts.promptRelativePath,
    rendered,
    success,
  };
}

export async function runGovernanceAiDrift(
  options: GovernanceAiDriftRunOptions = {}
): Promise<GovernanceAiDriftRunResult> {
  const snapshotPaths = await listMetricSnapshots(options.snapshotDir);
  const baselinePath = resolveSnapshotPath(
    options.baseline,
    snapshotPaths.at(-2)
  );
  const currentPath = resolveSnapshotPath(
    options.current,
    snapshotPaths.at(-1)
  );

  let comparison: SnapshotComparison | null = null;
  let signals: DriftSignal[] = [];
  let summary = buildDriftSummary([]);

  if (baselinePath && currentPath) {
    const baseline = await readMetricSnapshot(baselinePath);
    const current = await readMetricSnapshot(currentPath);
    comparison = compareSnapshots(baseline, current);
    signals = summarizeDrift(comparison, options.driftThreshold ?? 0.02);
    summary = buildDriftSummary(signals);
  }

  const request: AiAnalysisRequest = {
    kind: 'drift',
    generatedAt: new Date().toISOString(),
    profile: options.profile ?? GOVERNANCE_DEFAULT_PROFILE_NAME,
    inputs: {
      comparison: comparison ?? undefined,
      metadata: {
        signals,
        driftSummary: summary,
        snapshotCount: snapshotPaths.length,
        trendWindowInsufficient: snapshotPaths.length < 4 || !comparison,
      },
    },
  };

  const analysis = summarizeDriftInterpretation(request, signals, summary);
  const { request: scopedDriftRequest, payloadScope: driftPayloadScope } =
    buildScopedDriftRequest({
      request,
      comparison: comparison ?? undefined,
      signals,
      summary,
      signalLimit: AI_PAYLOAD_LIMITS.driftSignals,
      deltaLimit: AI_PAYLOAD_LIMITS.driftDeltas,
      violationLimit: AI_PAYLOAD_LIMITS.driftViolations,
    });

  const handoffArtifacts = exportAiHandoffArtifacts({
    workspaceRoot,
    useCase: 'drift',
    payload: buildAiDriftHandoffPayload({
      request: scopedDriftRequest,
      analysis,
      payloadScope: { ...driftPayloadScope },
    }),
  });

  const rendered =
    options.output === 'json'
      ? JSON.stringify(
          {
            request,
            analysis,
            comparison,
            signals,
            summary,
          },
          null,
          2
        )
      : renderAiDriftCliReport(analysis);

  if (options.output === 'json') {
    process.stdout.write(`${rendered}\n`);
  } else {
    logger.info(rendered);
  }

  process.stderr.write(`${handoffArtifacts.instructions}\n`);

  return {
    request,
    analysis,
    comparison,
    signals,
    summary,
    handoffPayloadPath: handoffArtifacts.payloadRelativePath,
    handoffPromptPath: handoffArtifacts.promptRelativePath,
    rendered,
    success: true,
  };
}

export async function runGovernanceAiCognitiveLoad(
  options: GovernanceAiCognitiveLoadRunOptions = {}
): Promise<GovernanceAiCognitiveLoadRunResult> {
  const { assessment } = await buildAssessmentArtifacts({
    ...options,
    reportType: 'health',
  });
  const workspace = readCanonicalWorkspace(assessment);
  const projectNodes = readProjectNodes(workspace);
  const dependencyRelations = readDependencyRelations(workspace);

  const selectedNodes = projectNodes
    .filter((node) => {
      if (options.project) {
        return (
          resolveNodeLabel(node) === options.project ||
          node.id === options.project
        );
      }

      if (options.domain) {
        return readNodeDomain(node, readNodeTags(node)) === options.domain;
      }

      return true;
    })
    .sort((a, b) => resolveNodeLabel(a).localeCompare(resolveNodeLabel(b)));

  const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
  const { items: scopedRelations } = scopeGovernanceRelations(
    dependencyRelations,
    selectedNodeIds
  );
  const cognitiveLoadContext = buildCognitiveLoadContext({
    selectedNodeIds: [...selectedNodeIds].sort((left, right) =>
      left.localeCompare(right)
    ),
    relations: dependencyRelations,
    nodes: projectNodes,
    scope: options.project
      ? 'project'
      : options.domain
      ? 'domain'
      : 'workspace',
    nodeId: selectedNodes[0]?.id,
    domain: options.domain,
    topProjectsLimit: Math.max(1, options.topProjects ?? 10),
  });

  const request = buildCognitiveLoadRequest({
    profile: options.profile ?? assessment.profile,
    affectedNodeIds: [...selectedNodeIds].sort((left, right) =>
      left.localeCompare(right)
    ),
    affectedRelationIds: collectAffectedRelationIds(
      workspace.relations,
      selectedNodeIds
    ),
    relations: scopedRelations,
    metadata: {
      ...cognitiveLoadContext,
    },
  });

  const analysis = summarizeCognitiveLoad(request);
  const rendered =
    options.output === 'json'
      ? JSON.stringify({ request, analysis }, null, 2)
      : renderAiCognitiveLoadCliReport(analysis);

  if (options.output === 'json') {
    process.stdout.write(`${rendered}\n`);
  } else {
    logger.info(rendered);
  }

  const success =
    !options.failOnViolation || (assessment.violations?.length ?? 0) === 0;

  return {
    request,
    analysis,
    rendered,
    success,
  };
}

export async function runGovernanceAiRecommendations(
  options: GovernanceAiRecommendationsRunOptions = {}
): Promise<GovernanceAiRecommendationsRunResult> {
  const { assessment } = await buildAssessmentArtifacts({
    ...options,
    reportType: 'health',
  });
  const dependencyRelations = readDependencyRelations(
    readCanonicalWorkspace(assessment)
  );

  const prioritizedViolations = rankTopViolations(
    assessment.violations.map(toRankedViolationInput),
    options.topViolations ?? 10
  );

  const snapshotPaths = await listMetricSnapshots(options.snapshotDir);
  let comparison: SnapshotComparison | undefined;
  let trendContext = buildRecommendationsTrendContext({
    signals: [],
    summary: buildDriftSummary([]),
    snapshotCount: snapshotPaths.length,
  });

  if (snapshotPaths.length >= 2) {
    const baseline = await readMetricSnapshot(snapshotPaths.at(-2) as string);
    const current = await readMetricSnapshot(snapshotPaths.at(-1) as string);
    comparison = compareSnapshots(baseline, current);
    const comparisonSignals = summarizeDrift(comparison);
    trendContext = buildRecommendationsTrendContext({
      signals: comparisonSignals,
      summary: buildDriftSummary(comparisonSignals),
      snapshotCount: snapshotPaths.length,
    });
  }

  const request = buildArchitectureRecommendationsRequest({
    profile: options.profile ?? assessment.profile,
    relations: dependencyRelations,
    topViolations: prioritizedViolations,
    comparison,
    metadata: {
      totalViolations: assessment.violations.length,
      analyzedViolations: prioritizedViolations.length,
      worseningSignalCount: trendContext.worseningSignalCount,
      snapshotCount: trendContext.snapshotCount,
    },
  });

  const analysis = summarizeArchitectureRecommendations(request);
  const rendered =
    options.output === 'json'
      ? JSON.stringify({ request, analysis }, null, 2)
      : renderAiRecommendationsCliReport(analysis);

  if (options.output === 'json') {
    process.stdout.write(`${rendered}\n`);
  } else {
    logger.info(rendered);
  }

  const success =
    !options.failOnViolation || (assessment.violations?.length ?? 0) === 0;

  return {
    request,
    analysis,
    rendered,
    success,
  };
}

export async function runGovernanceAiSmellClusters(
  options: GovernanceAiSmellClustersRunOptions = {}
): Promise<GovernanceAiSmellClustersRunResult> {
  const { assessment } = await buildAssessmentArtifacts({
    ...options,
    reportType: 'health',
  });
  const dependencyRelations = readDependencyRelations(
    readCanonicalWorkspace(assessment)
  );

  const prioritizedViolations = rankTopViolations(
    assessment.violations.map(toRankedViolationInput),
    options.topViolations ?? 10
  );

  const snapshotPaths = await listMetricSnapshots(options.snapshotDir);
  const recentPaths = snapshotPaths.slice(-3);
  const recentSnapshots = await Promise.all(
    recentPaths.map((snapshotPath) => readMetricSnapshot(snapshotPath))
  );
  const persistentSmellSignals = buildPersistentSmellSignals({
    recentSnapshots,
  });

  const request = buildSmellClustersRequest({
    profile: options.profile ?? assessment.profile,
    relations: dependencyRelations,
    topViolations: prioritizedViolations,
    metadata: {
      analyzedViolations: prioritizedViolations.length,
      totalViolations: assessment.violations.length,
      snapshotCount: snapshotPaths.length,
      sampledSnapshotCount: recentSnapshots.length,
      persistentSmellSignals,
    },
  });

  const analysis = summarizeSmellClusters(request);
  const rendered =
    options.output === 'json'
      ? JSON.stringify({ request, analysis }, null, 2)
      : renderAiSmellClustersCliReport(analysis);

  if (options.output === 'json') {
    process.stdout.write(`${rendered}\n`);
  } else {
    logger.info(rendered);
  }

  const success =
    !options.failOnViolation || (assessment.violations?.length ?? 0) === 0;

  return {
    request,
    analysis,
    rendered,
    success,
  };
}

export async function runGovernanceAiRefactoringSuggestions(
  options: GovernanceAiRefactoringSuggestionsRunOptions = {}
): Promise<GovernanceAiRefactoringSuggestionsRunResult> {
  const { assessment } = await buildAssessmentArtifacts({
    ...options,
    reportType: 'health',
  });
  const workspace = readCanonicalWorkspace(assessment);
  const projectNodes = readProjectNodes(workspace);
  const dependencyRelations = readDependencyRelations(workspace);

  const prioritizedViolations = rankTopViolations(
    assessment.violations.map(toRankedViolationInput),
    options.topViolations ?? 10
  );

  const topProjectsLimit = Math.max(1, options.topProjects ?? 5);
  const snapshotPaths = await listMetricSnapshots(options.snapshotDir);
  const recentPaths = snapshotPaths.slice(-3);
  const recentSnapshots = await Promise.all(
    recentPaths.map((snapshotPath) => readMetricSnapshot(snapshotPath))
  );
  const refactoringContext = buildRefactoringSuggestionsContext({
    violations: prioritizedViolations,
    relations: dependencyRelations,
    nodes: projectNodes,
    recentSnapshots,
    topProjectsLimit,
  });

  const request = buildRefactoringSuggestionsRequest({
    profile: options.profile ?? assessment.profile,
    relations: dependencyRelations,
    topViolations: prioritizedViolations,
    metadata: { ...refactoringContext },
  });

  const analysis = summarizeRefactoringSuggestions(request);
  const rendered =
    options.output === 'json'
      ? JSON.stringify({ request, analysis }, null, 2)
      : renderAiRefactoringSuggestionsCliReport(analysis);

  if (options.output === 'json') {
    process.stdout.write(`${rendered}\n`);
  } else {
    logger.info(rendered);
  }

  const success =
    !options.failOnViolation || (assessment.violations?.length ?? 0) === 0;

  return {
    request,
    analysis,
    rendered,
    success,
  };
}

export async function runGovernanceAiScorecard(
  options: GovernanceAiScorecardRunOptions = {}
): Promise<GovernanceAiScorecardRunResult> {
  const { assessment } = await buildAssessmentArtifacts({
    ...options,
    reportType: 'health',
  });

  const snapshotPaths = await listMetricSnapshots(options.snapshotDir);
  const resolvedSnapshotPath = resolveSnapshotPath(
    options.snapshotPath,
    snapshotPaths.at(-1)
  );

  const snapshotSource =
    resolvedSnapshotPath ||
    (
      await saveMetricSnapshot({
        assessment,
        snapshotDir: options.snapshotDir,
      })
    ).filePath;

  const snapshot = await readMetricSnapshot(snapshotSource);

  let comparison: SnapshotComparison | undefined;
  if (snapshotPaths.length >= 2) {
    const baseline = await readMetricSnapshot(snapshotPaths.at(-2) as string);
    const current = await readMetricSnapshot(snapshotPaths.at(-1) as string);
    comparison = compareSnapshots(baseline, current);
  }

  const request = buildScorecardRequest({
    profile: options.profile ?? assessment.profile,
    snapshot,
    comparison,
    metadata: {
      snapshotPath: path.relative(workspaceRoot, snapshotSource),
      workspaceHealthScore: assessment.health.score,
      workspaceHealthStatus: assessment.health.status,
      workspaceHealthGrade: assessment.health.grade,
      totalViolations: assessment.violations.length,
      measurementsCount: assessment.measurements.length,
      snapshotCount: snapshotPaths.length,
    },
  });

  const analysis = summarizeScorecard(request);
  const {
    request: scopedScorecardRequest,
    payloadScope: scorecardPayloadScope,
  } = buildScopedScorecardRequest({
    request,
    snapshot,
    comparison,
    violationLimit: AI_PAYLOAD_LIMITS.scorecardViolations,
    deltaLimit: AI_PAYLOAD_LIMITS.scorecardDeltas,
  });

  const handoffArtifacts = exportAiHandoffArtifacts({
    workspaceRoot,
    useCase: 'scorecard',
    payload: buildAiScorecardHandoffPayload({
      request: scopedScorecardRequest,
      analysis,
      payloadScope: { ...scorecardPayloadScope },
    }),
  });

  const rendered =
    options.output === 'json'
      ? JSON.stringify({ request, analysis }, null, 2)
      : renderAiScorecardCliReport(analysis);

  if (options.output === 'json') {
    process.stdout.write(`${rendered}\n`);
  } else {
    logger.info(rendered);
  }

  process.stderr.write(`${handoffArtifacts.instructions}\n`);

  const success =
    !options.failOnViolation || (assessment.violations?.length ?? 0) === 0;

  return {
    request,
    analysis,
    handoffPayloadPath: handoffArtifacts.payloadRelativePath,
    handoffPromptPath: handoffArtifacts.promptRelativePath,
    rendered,
    success,
  };
}

export async function runGovernanceAiOnboarding(
  options: GovernanceAiOnboardingRunOptions = {}
): Promise<GovernanceAiOnboardingRunResult> {
  const { assessment } = await buildAssessmentArtifacts({
    ...options,
    reportType: 'health',
  });
  const workspace = readCanonicalWorkspace(assessment);
  const projectNodes = readProjectNodes(workspace);
  const dependencyRelations = readDependencyRelations(workspace);

  const prioritizedViolations = rankTopViolations(
    assessment.violations.map(toRankedViolationInput),
    options.topViolations ?? 10
  );

  const onboardingContext = buildOnboardingContext({
    nodes: projectNodes,
    relations: dependencyRelations,
    topViolations: prioritizedViolations,
    topProjectsLimit: Math.max(1, options.topProjects ?? 5),
    totalViolationsCount: assessment.violations.length,
  });

  const request = buildOnboardingRequest({
    profile: options.profile ?? assessment.profile,
    relations: dependencyRelations,
    topViolations: prioritizedViolations,
    metadata: { ...onboardingContext },
  });

  const analysis = summarizeOnboarding(request);
  const rendered =
    options.output === 'json'
      ? JSON.stringify({ request, analysis }, null, 2)
      : renderAiOnboardingCliReport(analysis);

  if (options.output === 'json') {
    process.stdout.write(`${rendered}\n`);
  } else {
    logger.info(rendered);
  }

  const success =
    !options.failOnViolation || (assessment.violations?.length ?? 0) === 0;

  return {
    request,
    analysis,
    rendered,
    success,
  };
}

export async function buildGovernanceAssessmentArtifacts(
  options: GovernanceRunOptions,
  artifactsOptions: GovernanceAssessmentArtifactsOptions = {}
): Promise<GovernanceAssessmentArtifacts> {
  return buildAssessmentArtifacts(options, artifactsOptions);
}

async function buildAssessmentArtifacts(
  options: GovernanceRunOptions,
  artifactsOptions: GovernanceAssessmentArtifactsOptions = {}
): Promise<GovernanceAssessmentArtifacts> {
  const profileName = options.profile ?? GOVERNANCE_DEFAULT_PROFILE_NAME;
  const builtInProfile = resolveBuiltInGovernanceProfile(profileName);

  const overrides = await loadProfileOverrides(workspaceRoot, profileName);
  const effectiveProfile: GovernanceProfile = {
    ...builtInProfile,
    layers: overrides.layers ?? builtInProfile.layers,
    rules: {
      ...(builtInProfile.rules ?? {}),
      ...(overrides.rules ?? {}),
    },
    allowedLayerDependencies:
      overrides.allowedLayerDependencies ??
      builtInProfile.allowedLayerDependencies,
    allowedDomainDependencies:
      overrides.allowedDomainDependencies ??
      builtInProfile.allowedDomainDependencies,
    ownership: {
      ...builtInProfile.ownership,
      ...(overrides.ownership ?? {}),
    },
    health: {
      statusThresholds: {
        ...builtInProfile.health.statusThresholds,
        ...(overrides.health?.statusThresholds ?? {}),
      },
    },
    metrics: {
      ...builtInProfile.metrics,
      ...normalizeMetricWeights(overrides.metrics),
    },
  };

  const resolvedConformanceInput = resolveConformanceInput(
    options.conformanceJson
  );
  const conformanceSnapshot = loadConformanceSnapshot(resolvedConformanceInput);
  const { adapterResult, artifacts } = await composeNxGovernanceRuntime({
    workspaceRoot,
    profileName,
    options: { ...options } as Record<string, unknown>,
    profile: effectiveProfile,
    profileOverrides: overrides,
    warnings: overrides.runtimeWarnings,
    exceptions: overrides.exceptions,
    conformanceFindings:
      conformanceSnapshot?.findings.map(toGovernanceConformanceFinding) ?? [],
    asOf: artifactsOptions.asOf,
  });

  return {
    ...artifacts,
    adapterResult,
    profileComposition: overrides.composition,
    assessment: buildGovernanceAssessment({
      workspace: artifacts.workspace,
      profile: profileName,
      warnings: overrides.runtimeWarnings,
      exceptions: artifacts.assessment.exceptions,
      violations: artifacts.violations,
      signals: artifacts.signals,
      measurements: artifacts.measurements,
      health: artifacts.assessment.health,
      recommendations: artifacts.recommendations,
      reportType: options.reportType,
    }),
  };
}

function resolveProfileConfiguredOutput(
  artifacts: GovernanceAssessmentArtifacts
): GovernanceRunOptions['output'] {
  const renderers = artifacts.profileComposition?.renderers ?? [];
  const cliRenderer = renderers.find((renderer) => renderer.id === 'cli');
  const jsonRenderer = renderers.find((renderer) => renderer.id === 'json');

  if (cliRenderer?.enabled === false && jsonRenderer?.enabled === true) {
    return 'json';
  }

  return 'cli';
}

function readCanonicalWorkspace(
  assessment: GovernanceAssessment
): RuntimeGovernanceWorkspace {
  return assessment.workspace as unknown as RuntimeGovernanceWorkspace;
}

function readProjectNodes(
  workspace: RuntimeGovernanceWorkspace
): GovernanceNode[] {
  return [...workspace.nodes]
    .filter((node) => node.kind === 'project')
    .map(toGovernanceNode)
    .sort((left, right) =>
      resolveNodeLabel(left).localeCompare(resolveNodeLabel(right))
    );
}

function readDependencyRelations(
  workspace: RuntimeGovernanceWorkspace
): GovernanceRelation[] {
  return [...workspace.relations]
    .filter((relation) => relation.kind === 'dependency')
    .map(toGovernanceRelation)
    .sort((left, right) =>
      resolveRelationId(left).localeCompare(resolveRelationId(right))
    );
}

function collectAffectedNodeIds(
  nodes: readonly GovernanceNode[],
  changedFiles: readonly string[]
): Set<string> {
  const affectedNodeIds = new Set<string>();

  for (const node of nodes) {
    const candidateRoots = [node.root, node.path]
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0
      )
      .sort((left, right) => left.localeCompare(right));

    if (
      candidateRoots.some((root) =>
        changedFiles.some((changedFile) => isFileWithinRoot(changedFile, root))
      )
    ) {
      affectedNodeIds.add(node.id);
    }
  }

  return affectedNodeIds;
}

function collectAffectedRelationIds(
  relations: readonly GovernanceRelation[],
  affectedNodeIds: ReadonlySet<string>
): string[] {
  return relations
    .filter(
      (relation) =>
        affectedNodeIds.has(relation.sourceNodeId) ||
        affectedNodeIds.has(relation.targetNodeId)
    )
    .map((relation) => resolveRelationId(relation))
    .sort((left, right) => left.localeCompare(right));
}

function resolveNodeLabel(node: Pick<GovernanceNode, 'id' | 'name'>): string {
  return node.name ?? node.id;
}

function resolveRelationId(relation: RuntimeGovernanceRelation): string {
  if (relation.id) {
    return relation.id;
  }

  const relationMetadata = relation.metadata ?? {};
  const nxMetadata = asRecord(relationMetadata['nx']);
  const dependencyType =
    readString(nxMetadata?.['dependencyType']) ??
    readString(relationMetadata['dependencyType']) ??
    relation.kind ??
    'unknown';
  const sourceFile =
    readString(nxMetadata?.['sourceFile']) ??
    readString(relationMetadata['sourceFile']) ??
    '';

  return `${relation.sourceNodeId}->${relation.targetNodeId}:${dependencyType}:${sourceFile}`;
}

function toGovernanceNode(node: RuntimeGovernanceNode): GovernanceNode {
  return {
    id: node.id,
    name: node.name,
    kind: node.kind ?? 'unknown',
    technology: node.technology,
    sourceSystem: node.sourceSystem,
    root: node.root,
    path: node.path,
    tags: [...(node.tags ?? [])],
    ...(node.classification ? { classification: node.classification } : {}),
    ...(node.ownership ? { ownership: node.ownership } : {}),
    metadata: node.metadata ?? {},
  };
}

function toGovernanceRelation(
  relation: RuntimeGovernanceRelation
): GovernanceRelation {
  return {
    id: resolveRelationId(relation),
    sourceNodeId: relation.sourceNodeId,
    targetNodeId: relation.targetNodeId,
    kind: relation.kind ?? 'unknown',
    metadata: relation.metadata ?? {},
  };
}

function readNodeTags(
  node: Pick<GovernanceNode, 'tags' | 'classification'>
): string[] {
  if (Array.isArray(node.tags) && node.tags.length > 0) {
    return [...node.tags];
  }

  const classification = asRecord(node.classification);
  const classificationTags = classification?.['tags'];

  return Array.isArray(classificationTags)
    ? classificationTags.filter((tag): tag is string => typeof tag === 'string')
    : [];
}

function readNodeDomain(
  node: Pick<GovernanceNode, 'classification'>,
  tags: readonly string[]
): string | undefined {
  const classification = asRecord(node.classification);

  return readString(classification?.['domain']) ?? readTagValue(tags, 'domain');
}

function isFileWithinRoot(filePath: string, root: string): boolean {
  return filePath === root || filePath.startsWith(`${root}/`);
}

function readTagValue(
  tags: readonly string[],
  prefix: string
): string | undefined {
  const tag = tags.find((entry) => entry.startsWith(`${prefix}:`));

  return tag ? tag.split(':').slice(1).join(':') : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toRankedViolationInput(
  violation: GovernanceAssessment['violations'][number]
): Parameters<typeof rankTopViolations>[0][number] {
  const source =
    violation.subjectId ??
    violation.reference?.nodeId ??
    violation.reference?.relationId ??
    'unknown';
  const target =
    typeof violation.details?.target === 'string'
      ? violation.details.target
      : violation.reference?.relatedNodeIds?.find(
          (nodeId) => typeof nodeId === 'string' && nodeId !== source
        );

  return {
    type: violation.ruleId,
    source,
    target,
    severity: violation.severity,
    message: violation.message,
    ruleId: violation.ruleId,
  };
}

function toGovernanceConformanceFinding(
  finding: ConformanceFinding
): NonNullable<
  Parameters<typeof composeNxGovernanceRuntime>[0]['conformanceFindings']
>[number] {
  return {
    ruleId: finding.ruleId,
    nodeId: finding.projectId,
    relatedNodeIds: [...finding.relatedProjectIds],
    relatedRelationIds: [],
    category: finding.category,
    severity: finding.severity,
    message: finding.message,
    ...(finding.metadata ? { metadata: finding.metadata } : {}),
  };
}

function normalizeMetricWeights(
  metrics: Record<string, number | undefined> | undefined
): GovernanceProfile['metrics'] {
  if (!metrics) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metrics).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number'
    )
  );
}

function loadConformanceSnapshot(
  input: ReturnType<typeof resolveConformanceInput>
): ConformanceSnapshot | undefined {
  if (!input.conformanceJson) {
    return undefined;
  }

  try {
    return readConformanceSnapshot({ conformanceJson: input.conformanceJson });
  } catch (error) {
    if (input.source === 'nx-json') {
      throw new Error(
        `Unable to load Nx Conformance output configured in nx.json at "${
          input.conformanceJson
        }": ${toErrorMessage(error)}`
      );
    }

    throw error;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error.';
}

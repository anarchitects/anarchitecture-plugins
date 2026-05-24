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
  buildOnboardingContext,
  buildGovernanceAssessmentArtifacts as buildCoreGovernanceAssessmentArtifacts,
  buildPersistentSmellSignals,
  buildPrImpactContext,
  buildGovernanceWorkspace,
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
  DefaultGovernanceCapabilityRegistry,
  DeliveryImpactAssessment,
  DriftSignal,
  DriftSummary,
  GovernanceAssessment,
  GovernanceProfile,
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
  summarizeDrift,
  scopeGovernanceDependencies,
} from '@anarchitects/governance-core';
import { loadNxGovernanceWorkspaceContext } from '@anarchitects/governance-adapter-nx';

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
import {
  readChangedFiles,
  resolveAffectedProjects,
} from './pr-impact-host-context.js';
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
import { loadGovernanceExtensionConfig } from '../nx-host/extensions/config.js';
import { registerNxGovernanceExtensionsWithDiagnostics as registerGovernanceExtensionsWithDiagnostics } from '../nx-host/extensions/host.js';
import {
  resolveOptionalSnapshotComparison,
  resolveSnapshotPath,
  toSnapshotDeliveryImpactSummary,
} from './snapshot-runtime.js';
import type { GovernanceAssessmentArtifacts } from './build-assessment-artifacts.js';
import type { ConformanceSnapshot } from '../conformance-adapter/conformance-adapter.js';
import { AI_PAYLOAD_LIMITS } from './ai-payload-scope.js';
import { summarizeDriftInterpretation } from './drift-ai-analysis.js';

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
  const { assessment } = await buildAssessmentArtifacts(options);

  const rendered =
    options.output === 'json'
      ? renderJsonReport(assessment)
      : renderCliReport(assessment);

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
    deliveryImpact: toSnapshotDeliveryImpactSummary(deliveryImpact),
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
    dependencies: assessment.workspace.dependencies,
    topViolations,
    metadata: {
      snapshotPath: path.relative(workspaceRoot, snapshotSource),
      totalViolations: snapshot.violations.length,
      selectedViolations: topViolations.length,
    },
  });
  const analysis = summarizeRootCause(request);
  const rootCauseProjectScope = new Set<string>();
  for (const violation of topViolations) {
    rootCauseProjectScope.add(violation.source);
    if (violation.target) {
      rootCauseProjectScope.add(violation.target);
    }
  }

  const {
    request: scopedRootCauseRequest,
    payloadScope: rootCausePayloadScope,
  } = buildScopedRootCauseRequest({
    request,
    dependencies: assessment.workspace.dependencies,
    topViolations,
    projectScope: rootCauseProjectScope,
    dependencyLimit: AI_PAYLOAD_LIMITS.rootCauseDependencies,
    topViolationsLimit: options.topViolations ?? 10,
  });

  const handoffArtifacts = exportAiHandoffArtifacts({
    workspaceRoot,
    useCase: 'root-cause',
    payload: buildAiRootCauseHandoffPayload({
      request: scopedRootCauseRequest,
      analysis,
      payloadScope: {
        dependencies: rootCausePayloadScope.dependencies,
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

  const baseRef = options.baseRef ?? 'main';
  const headRef = options.headRef ?? 'HEAD';
  const changedFiles = readChangedFiles(baseRef, headRef);

  const affectedProjects = resolveAffectedProjects(
    assessment.workspace.projects,
    changedFiles
  );
  const affectedProjectSet = new Set(
    affectedProjects.map((project) => project.name)
  );
  const { items: scopedDependencies } = scopeGovernanceDependencies(
    assessment.workspace.dependencies,
    affectedProjectSet
  );
  const prImpactContext = buildPrImpactContext({
    affectedProjects,
    dependencies: assessment.workspace.dependencies,
    projects: assessment.workspace.projects,
    changedFiles,
    changedFilesCount: changedFiles.length,
  });

  const request = buildPrImpactRequest({
    profile: options.profile ?? assessment.profile,
    affectedProjects: affectedProjects.map((project) => project.name),
    dependencies: scopedDependencies,
    metadata: {
      baseRef,
      headRef,
      changedFiles,
      ...prImpactContext,
    },
  });

  const analysis = summarizePrImpact(request);
  const prImpactDependencySlice = scopeGovernanceDependencies(
    scopedDependencies,
    affectedProjectSet,
    AI_PAYLOAD_LIMITS.prImpactDependencies
  );

  const scopedPrImpactRequest = {
    ...request,
    inputs: {
      ...request.inputs,
      dependencies: prImpactDependencySlice.items,
      metadata: {
        ...(request.inputs.metadata ?? {}),
        payloadScope: {
          dependencies: prImpactDependencySlice.truncation,
          affectedProjects: buildGovernancePayloadTruncationMetadata(
            affectedProjects.length,
            affectedProjects.length,
            affectedProjects.length
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
        dependencies: prImpactDependencySlice.truncation,
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

  const selectedProjects = assessment.workspace.projects
    .filter((project) => {
      if (options.project) {
        return project.name === options.project;
      }

      if (options.domain) {
        return project.domain === options.domain;
      }

      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedProjectNames = new Set(
    selectedProjects.map((project) => project.name)
  );
  const { items: scopedDependencies } = scopeGovernanceDependencies(
    assessment.workspace.dependencies,
    selectedProjectNames
  );
  const cognitiveLoadContext = buildCognitiveLoadContext({
    selectedProjects,
    dependencies: assessment.workspace.dependencies,
    projects: assessment.workspace.projects,
    scope: options.project
      ? 'project'
      : options.domain
      ? 'domain'
      : 'workspace',
    project: options.project,
    domain: options.domain,
    topProjectsLimit: Math.max(1, options.topProjects ?? 10),
  });

  const request = buildCognitiveLoadRequest({
    profile: options.profile ?? assessment.profile,
    affectedProjects: selectedProjects.map((project) => project.name),
    dependencies: scopedDependencies,
    metadata: { ...cognitiveLoadContext },
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

  const prioritizedViolations = rankTopViolations(
    assessment.violations.map((violation) => ({
      type: violation.ruleId,
      source: violation.project,
      target:
        typeof violation.details?.target === 'string'
          ? violation.details.target
          : undefined,
      severity: violation.severity,
      message: violation.message,
      ruleId: violation.ruleId,
    })),
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
    dependencies: assessment.workspace.dependencies,
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

  const prioritizedViolations = rankTopViolations(
    assessment.violations.map((violation) => ({
      type: violation.ruleId,
      source: violation.project,
      target:
        typeof violation.details?.target === 'string'
          ? violation.details.target
          : undefined,
      severity: violation.severity,
      message: violation.message,
      ruleId: violation.ruleId,
    })),
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
    dependencies: assessment.workspace.dependencies,
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

  const prioritizedViolations = rankTopViolations(
    assessment.violations.map((violation) => ({
      type: violation.ruleId,
      source: violation.project,
      target:
        typeof violation.details?.target === 'string'
          ? violation.details.target
          : undefined,
      severity: violation.severity,
      message: violation.message,
      ruleId: violation.ruleId,
    })),
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
    dependencies: assessment.workspace.dependencies,
    projects: assessment.workspace.projects,
    recentSnapshots,
    topProjectsLimit,
  });

  const request = buildRefactoringSuggestionsRequest({
    profile: options.profile ?? assessment.profile,
    dependencies: assessment.workspace.dependencies,
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

  const prioritizedViolations = rankTopViolations(
    assessment.violations.map((violation) => ({
      type: violation.ruleId,
      source: violation.project,
      target:
        typeof violation.details?.target === 'string'
          ? violation.details.target
          : undefined,
      severity: violation.severity,
      message: violation.message,
      ruleId: violation.ruleId,
    })),
    options.topViolations ?? 10
  );

  const onboardingContext = buildOnboardingContext({
    projects: assessment.workspace.projects,
    dependencies: assessment.workspace.dependencies,
    topViolations: prioritizedViolations,
    topProjectsLimit: Math.max(1, options.topProjects ?? 5),
    totalViolationsCount: assessment.violations.length,
  });

  const request = buildOnboardingRequest({
    profile: options.profile ?? assessment.profile,
    dependencies: assessment.workspace.dependencies,
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

  const { adapterResult } = await loadNxGovernanceWorkspaceContext();
  const inventory = buildGovernanceWorkspace(adapterResult, overrides);
  loadGovernanceExtensionConfig({ workspaceRoot });
  const adapterCapabilities = adapterResult.capabilities ?? [];
  const capabilities = new DefaultGovernanceCapabilityRegistry(
    adapterCapabilities
  );
  const extensionContext = {
    workspaceRoot,
    profileName,
    options: { ...options },
    inventory,
    capabilities,
  };
  const extensionRegistration =
    await registerGovernanceExtensionsWithDiagnostics({
      ...extensionContext,
    });
  const resolvedConformanceInput = resolveConformanceInput(
    options.conformanceJson
  );
  const conformanceSnapshot = loadConformanceSnapshot(resolvedConformanceInput);
  const artifacts = await buildCoreGovernanceAssessmentArtifacts({
    profile: effectiveProfile,
    workspace: inventory,
    warnings: overrides.runtimeWarnings,
    exceptions: overrides.exceptions,
    conformanceFindings: conformanceSnapshot?.findings ?? [],
    capabilities: adapterCapabilities,
    diagnostics: adapterResult.diagnostics ?? [],
    extensionRegistry: extensionRegistration.registry,
    extensionContext,
    extensionDiagnostics: extensionRegistration.diagnostics,
    asOf: artifactsOptions.asOf,
  });

  return {
    ...artifacts,
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

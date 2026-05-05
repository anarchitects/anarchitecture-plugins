import { logger, workspaceRoot } from '@nx/devkit';

import { GovernanceAssessment, GovernanceProfile } from '../core/index.js';
import {
  buildRecommendations,
  calculateHealthScore,
} from '../health-engine/calculate-health.js';
import { buildInventory } from '../inventory/build-inventory.js';
import { calculateMetrics } from '../metric-engine/calculate-metrics.js';
import { readNxWorkspaceSnapshot } from '../nx-adapter/read-workspace.js';
import { evaluatePolicies } from '../policy-engine/evaluate-policies.js';
import {
  angularCleanupProfile,
  loadProfileOverrides,
} from '../presets/angular-cleanup/profile.js';
import { GOVERNANCE_DEFAULT_PROFILE_NAME } from '../profile/runtime-profile.js';
import { renderCliReport } from '../reporting/render-cli.js';
import { renderJsonReport } from '../reporting/render-json.js';
import { buildMetricBreakdown } from '../reporting/metric-breakdown.js';
import {
  buildSignalBreakdown,
  filterSignalsForReportType,
} from '../reporting/signal-breakdown.js';
import { buildTopIssues } from '../reporting/top-issues.js';
import { MetricSnapshot } from '../core/models.js';
import {
  listMetricSnapshots,
  readMetricSnapshot,
  saveMetricSnapshot,
} from '../snapshot-store/index.js';
import {
  buildDriftSummary,
  compareSnapshots,
  summarizeDrift,
} from '../drift-analysis/index.js';
import { readConformanceSnapshot } from '../conformance-adapter/conformance-adapter.js';
import {
  DriftSummary,
  DriftSignal,
  GovernanceDependency,
  GovernanceWorkspace,
  SnapshotComparison,
  SnapshotViolation,
} from '../core/index.js';
import path from 'node:path';
import {
  buildArchitectureRecommendationsRequest,
  buildCognitiveLoadRequest,
  buildOnboardingRequest,
  buildScorecardRequest,
  buildRefactoringSuggestionsRequest,
  buildSmellClustersRequest,
  buildRootCauseRequest,
  buildPrImpactRequest,
  rankTopViolations,
  summarizeArchitectureRecommendations,
  summarizeCognitiveLoad,
  summarizeOnboarding,
  summarizeScorecard,
  summarizeRefactoringSuggestions,
  summarizeSmellClusters,
  summarizePrImpact,
  summarizeRootCause,
} from '../ai-analysis/index.js';
import { AiAnalysisRequest, AiAnalysisResult } from '../core/models.js';
import { execFileSync } from 'node:child_process';
import { exportAiHandoffArtifacts } from '../ai-handoff/index.js';
import { resolveConformanceInput } from './resolve-conformance-input.js';
import {
  buildConformanceSignals,
  buildGraphSignals,
  buildPolicySignals,
  mergeGovernanceSignals,
} from '../signal-engine/index.js';
import { WorkspaceGraphSnapshot } from '../nx-adapter/graph-adapter.js';
import {
  applyGovernanceEnrichers,
  collectGovernanceMeasurements,
  collectGovernanceSignals,
  evaluateGovernanceRulePacks,
  registerGovernanceExtensions,
} from '../extensions/host.js';
import { applyGovernanceExceptions } from './apply-governance-exceptions.js';
import type { GovernanceAssessmentArtifacts } from './build-assessment-artifacts.js';
import type { ConformanceSnapshot } from '../conformance-adapter/conformance-adapter.js';
import { buildExceptionReport } from './build-exception-report.js';

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

const AI_PAYLOAD_LIMITS = {
  rootCauseDependencies: 120,
  prImpactDependencies: 120,
  driftSignals: 12,
  driftDeltas: 12,
  driftViolations: 20,
  scorecardViolations: 20,
  scorecardDeltas: 12,
};

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

  const persisted = await saveMetricSnapshot({
    assessment,
    snapshotDir: options.snapshotDir,
    metricSchemaVersion: options.metricSchemaVersion,
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

export async function runGovernanceAiRootCause(
  options: GovernanceAiRootCauseRunOptions = {}
): Promise<GovernanceAiRootCauseRunResult> {
  const assessment = await buildAssessment({
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

  const rootCauseDependencySlice = sliceDependenciesForProjectScope(
    assessment.workspace.dependencies,
    rootCauseProjectScope,
    AI_PAYLOAD_LIMITS.rootCauseDependencies
  );

  const scopedRootCauseRequest = {
    ...request,
    inputs: {
      ...request.inputs,
      dependencies: rootCauseDependencySlice.items,
      metadata: {
        ...(request.inputs.metadata ?? {}),
        payloadScope: {
          projectScopeCount: rootCauseProjectScope.size,
          dependencies: rootCauseDependencySlice.truncation,
          violations: buildTruncationMetadata(
            snapshot.violations.length,
            topViolations.length,
            options.topViolations ?? 10
          ),
        },
      },
    },
  };

  const handoffArtifacts = exportAiHandoffArtifacts({
    workspaceRoot,
    useCase: 'root-cause',
    payload: {
      useCase: 'root-cause',
      request: scopedRootCauseRequest,
      analysis,
      payloadScope: {
        dependencies: rootCauseDependencySlice.truncation,
      },
      metadata: {
        snapshotPath: path.relative(workspaceRoot, snapshotSource),
      },
    },
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
  const assessment = await buildAssessment({
    ...options,
    reportType: 'health',
  });

  const baseRef = options.baseRef ?? 'main';
  const headRef = options.headRef ?? 'HEAD';
  const changedFiles = readChangedFiles(baseRef, headRef);

  const projectsByName = new Map(
    assessment.workspace.projects.map((project) => [project.name, project])
  );
  const affectedProjects = resolveAffectedProjects(assessment, changedFiles);
  const affectedProjectSet = new Set(
    affectedProjects.map((project) => project.name)
  );
  const affectedDomains = new Set(
    affectedProjects
      .map((project) => project.domain)
      .filter((domain): domain is string => Boolean(domain))
  );

  const scopedDependencies = assessment.workspace.dependencies.filter(
    (dependency) =>
      affectedProjectSet.has(dependency.source) ||
      affectedProjectSet.has(dependency.target)
  );

  const crossDomainDependencyEdges = scopedDependencies.filter((dependency) => {
    const sourceDomain = projectsByName.get(dependency.source)?.domain;
    const targetDomain = projectsByName.get(dependency.target)?.domain;
    return Boolean(
      sourceDomain && targetDomain && sourceDomain !== targetDomain
    );
  }).length;

  const request = buildPrImpactRequest({
    profile: options.profile ?? assessment.profile,
    affectedProjects: affectedProjects.map((project) => project.name),
    dependencies: scopedDependencies,
    metadata: {
      baseRef,
      headRef,
      changedFiles,
      changedFilesCount: changedFiles.length,
      affectedProjectsCount: affectedProjects.length,
      affectedDomainCount: affectedDomains.size,
      crossDomainDependencyEdges,
      affectedDomains: [...affectedDomains].sort((a, b) => a.localeCompare(b)),
    },
  });

  const analysis = summarizePrImpact(request);
  const prImpactDependencySlice = sliceDependenciesForProjectScope(
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
          affectedProjects: buildTruncationMetadata(
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
    payload: {
      useCase: 'pr-impact',
      request: scopedPrImpactRequest,
      analysis,
      payloadScope: {
        dependencies: prImpactDependencySlice.truncation,
      },
    },
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
  const signalSlice = sliceTopItems(
    signals,
    AI_PAYLOAD_LIMITS.driftSignals,
    (a, b) => b.magnitude - a.magnitude || a.id.localeCompare(b.id)
  );
  const metricDeltaSlice = sliceTopItems(
    comparison?.metricDeltas ?? [],
    AI_PAYLOAD_LIMITS.driftDeltas,
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.id.localeCompare(b.id)
  );
  const scoreDeltaSlice = sliceTopItems(
    comparison?.scoreDeltas ?? [],
    AI_PAYLOAD_LIMITS.driftDeltas,
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.id.localeCompare(b.id)
  );
  const newViolationSlice = sliceTopItems(
    comparison?.newViolations ?? [],
    AI_PAYLOAD_LIMITS.driftViolations,
    compareViolationsForPriority
  );
  const resolvedViolationSlice = sliceTopItems(
    comparison?.resolvedViolations ?? [],
    AI_PAYLOAD_LIMITS.driftViolations,
    compareViolationsForPriority
  );

  const scopedDriftRequest = {
    ...request,
    inputs: {
      ...request.inputs,
      comparison: comparison
        ? {
            baseline: {
              timestamp: comparison.baseline.timestamp,
              branch: comparison.baseline.branch,
              commitSha: comparison.baseline.commitSha,
            },
            current: {
              timestamp: comparison.current.timestamp,
              branch: comparison.current.branch,
              commitSha: comparison.current.commitSha,
            },
            metricDeltas: metricDeltaSlice.items,
            scoreDeltas: scoreDeltaSlice.items,
            newViolations: newViolationSlice.items,
            resolvedViolations: resolvedViolationSlice.items,
          }
        : undefined,
      metadata: {
        ...(request.inputs.metadata ?? {}),
        signals: signalSlice.items,
        driftSummary: summary,
        payloadScope: {
          signals: signalSlice.truncation,
          metricDeltas: metricDeltaSlice.truncation,
          scoreDeltas: scoreDeltaSlice.truncation,
          newViolations: newViolationSlice.truncation,
          resolvedViolations: resolvedViolationSlice.truncation,
        },
      },
    },
  };

  const handoffArtifacts = exportAiHandoffArtifacts({
    workspaceRoot,
    useCase: 'drift',
    payload: {
      useCase: 'drift',
      request: scopedDriftRequest,
      analysis,
      payloadScope: {
        signals: signalSlice.truncation,
        metricDeltas: metricDeltaSlice.truncation,
        scoreDeltas: scoreDeltaSlice.truncation,
        newViolations: newViolationSlice.truncation,
        resolvedViolations: resolvedViolationSlice.truncation,
      },
    },
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
  const assessment = await buildAssessment({
    ...options,
    reportType: 'health',
  });

  const projectsByName = new Map(
    assessment.workspace.projects.map((project) => [project.name, project])
  );

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
  const scopedDependencies = assessment.workspace.dependencies.filter(
    (dependency) =>
      selectedProjectNames.has(dependency.source) ||
      selectedProjectNames.has(dependency.target)
  );

  const fanoutByProject = new Map<string, number>();
  for (const dependency of scopedDependencies) {
    if (selectedProjectNames.has(dependency.source)) {
      fanoutByProject.set(
        dependency.source,
        (fanoutByProject.get(dependency.source) ?? 0) + 1
      );
    }
  }

  const fanoutValues = [...fanoutByProject.values()];
  const maxFanout = fanoutValues.length > 0 ? Math.max(...fanoutValues) : 0;
  const averageFanout =
    fanoutValues.length > 0
      ? Number(
          (
            fanoutValues.reduce((sum, value) => sum + value, 0) /
            fanoutValues.length
          ).toFixed(2)
        )
      : 0;

  const affectedDomains = new Set(
    selectedProjects
      .map((project) => project.domain)
      .filter((domain): domain is string => Boolean(domain))
  );
  const crossDomainDependencyEdges = scopedDependencies.filter((dependency) => {
    const sourceDomain = projectsByName.get(dependency.source)?.domain;
    const targetDomain = projectsByName.get(dependency.target)?.domain;
    return Boolean(
      sourceDomain && targetDomain && sourceDomain !== targetDomain
    );
  }).length;

  const topFanoutProjects = [...fanoutByProject.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(1, options.topProjects ?? 10))
    .map(([project, fanout]) => ({ project, fanout }));

  const request = buildCognitiveLoadRequest({
    profile: options.profile ?? assessment.profile,
    affectedProjects: selectedProjects.map((project) => project.name),
    dependencies: scopedDependencies,
    metadata: {
      scope: options.project
        ? 'project'
        : options.domain
        ? 'domain'
        : 'workspace',
      project: options.project,
      domain: options.domain,
      selectedProjectsCount: selectedProjects.length,
      affectedDomainCount: affectedDomains.size,
      scopedDependencyCount: scopedDependencies.length,
      crossDomainDependencyEdges,
      averageFanout,
      maxFanout,
      topFanoutProjects,
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
  const assessment = await buildAssessment({
    ...options,
    reportType: 'health',
  });

  const prioritizedViolations = rankTopViolations(
    assessment.violations.map((violation) => ({
      type: violation.ruleId,
      source: violation.project,
      target: asString(violation.details?.target),
      severity: violation.severity,
      message: violation.message,
      ruleId: violation.ruleId,
    })),
    options.topViolations ?? 10
  );

  const snapshotPaths = await listMetricSnapshots(options.snapshotDir);
  let comparison: SnapshotComparison | undefined;
  let worseningSignalCount = 0;

  if (snapshotPaths.length >= 2) {
    const baseline = await readMetricSnapshot(snapshotPaths.at(-2) as string);
    const current = await readMetricSnapshot(snapshotPaths.at(-1) as string);
    comparison = compareSnapshots(baseline, current);
    worseningSignalCount = summarizeDrift(comparison).filter(
      (signal) => signal.status === 'worsening'
    ).length;
  }

  const request = buildArchitectureRecommendationsRequest({
    profile: options.profile ?? assessment.profile,
    dependencies: assessment.workspace.dependencies,
    topViolations: prioritizedViolations,
    comparison,
    metadata: {
      totalViolations: assessment.violations.length,
      analyzedViolations: prioritizedViolations.length,
      worseningSignalCount,
      snapshotCount: snapshotPaths.length,
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
  const assessment = await buildAssessment({
    ...options,
    reportType: 'health',
  });

  const prioritizedViolations = rankTopViolations(
    assessment.violations.map((violation) => ({
      type: violation.ruleId,
      source: violation.project,
      target: asString(violation.details?.target),
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

  const persistentKeyCounts = new Map<string, number>();
  for (const snapshot of recentSnapshots) {
    const uniqueKeys = new Set(
      snapshot.violations.map(
        (violation) => `${violation.type}|${violation.source}`
      )
    );

    for (const key of uniqueKeys) {
      persistentKeyCounts.set(key, (persistentKeyCounts.get(key) ?? 0) + 1);
    }
  }

  const persistentSmellSignals = [...persistentKeyCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([key, count]) => {
      const [type, source] = key.split('|');
      return { type: type ?? 'unknown', source: source ?? 'unknown', count };
    })
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

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
  const assessment = await buildAssessment({
    ...options,
    reportType: 'health',
  });

  const prioritizedViolations = rankTopViolations(
    assessment.violations.map((violation) => ({
      type: violation.ruleId,
      source: violation.project,
      target: asString(violation.details?.target),
      severity: violation.severity,
      message: violation.message,
      ruleId: violation.ruleId,
    })),
    options.topViolations ?? 10
  );

  const projectsByName = new Map(
    assessment.workspace.projects.map((project) => [project.name, project])
  );

  const hotspotCounts = new Map<string, number>();
  for (const violation of prioritizedViolations) {
    hotspotCounts.set(
      violation.source,
      (hotspotCounts.get(violation.source) ?? 0) + 1
    );
  }

  const fanoutCounts = new Map<string, number>();
  for (const dependency of assessment.workspace.dependencies) {
    fanoutCounts.set(
      dependency.source,
      (fanoutCounts.get(dependency.source) ?? 0) + 1
    );
  }

  const topProjectsLimit = Math.max(1, options.topProjects ?? 5);
  const hotspotProjects = [...hotspotCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topProjectsLimit)
    .map(([project, count]) => ({ project, count }));

  const highFanoutProjects = [...fanoutCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topProjectsLimit)
    .map(([project, count]) => ({ project, count }));

  const snapshotPaths = await listMetricSnapshots(options.snapshotDir);
  const recentPaths = snapshotPaths.slice(-3);
  const recentSnapshots = await Promise.all(
    recentPaths.map((snapshotPath) => readMetricSnapshot(snapshotPath))
  );

  const persistentKeyCounts = new Map<string, number>();
  for (const snapshot of recentSnapshots) {
    const uniqueKeys = new Set(
      snapshot.violations.map(
        (violation) => `${violation.type}|${violation.source}`
      )
    );

    for (const key of uniqueKeys) {
      persistentKeyCounts.set(key, (persistentKeyCounts.get(key) ?? 0) + 1);
    }
  }

  const persistentSmellSignals = [...persistentKeyCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([key, count]) => {
      const [type, source] = key.split('|');
      return { type: type ?? 'unknown', source: source ?? 'unknown', count };
    })
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  const hotspotDomains = [
    ...new Set(
      hotspotProjects
        .map((entry) => projectsByName.get(entry.project)?.domain)
        .filter((domain): domain is string => Boolean(domain))
    ),
  ].sort((a, b) => a.localeCompare(b));

  const request = buildRefactoringSuggestionsRequest({
    profile: options.profile ?? assessment.profile,
    dependencies: assessment.workspace.dependencies,
    topViolations: prioritizedViolations,
    metadata: {
      analyzedViolations: prioritizedViolations.length,
      totalViolations: assessment.violations.length,
      hotspotProjects,
      highFanoutProjects,
      persistentSmellSignals,
      snapshotCount: snapshotPaths.length,
      sampledSnapshotCount: recentSnapshots.length,
      hotspotDomains,
    },
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
  const assessment = await buildAssessment({
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
  const snapshotViolationSlice = sliceTopItems(
    snapshot.violations,
    AI_PAYLOAD_LIMITS.scorecardViolations,
    compareViolationsForPriority
  );
  const scorecardMetricDeltaSlice = sliceTopItems(
    comparison?.metricDeltas ?? [],
    AI_PAYLOAD_LIMITS.scorecardDeltas,
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.id.localeCompare(b.id)
  );
  const scorecardScoreDeltaSlice = sliceTopItems(
    comparison?.scoreDeltas ?? [],
    AI_PAYLOAD_LIMITS.scorecardDeltas,
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.id.localeCompare(b.id)
  );

  const scopedScorecardRequest = {
    ...request,
    inputs: {
      ...request.inputs,
      snapshot: {
        ...snapshot,
        violations: snapshotViolationSlice.items,
      },
      comparison: comparison
        ? {
            ...comparison,
            baseline: {
              ...comparison.baseline,
              violations: [],
            },
            current: {
              ...comparison.current,
              violations: [],
            },
            metricDeltas: scorecardMetricDeltaSlice.items,
            scoreDeltas: scorecardScoreDeltaSlice.items,
            newViolations: [],
            resolvedViolations: [],
          }
        : undefined,
      metadata: {
        ...(request.inputs.metadata ?? {}),
        payloadScope: {
          snapshotViolations: snapshotViolationSlice.truncation,
          metricDeltas: scorecardMetricDeltaSlice.truncation,
          scoreDeltas: scorecardScoreDeltaSlice.truncation,
        },
      },
    },
  };

  const handoffArtifacts = exportAiHandoffArtifacts({
    workspaceRoot,
    useCase: 'scorecard',
    payload: {
      useCase: 'scorecard',
      request: scopedScorecardRequest,
      analysis,
      payloadScope: {
        snapshotViolations: snapshotViolationSlice.truncation,
        metricDeltas: scorecardMetricDeltaSlice.truncation,
        scoreDeltas: scorecardScoreDeltaSlice.truncation,
      },
    },
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
  const assessment = await buildAssessment({
    ...options,
    reportType: 'health',
  });

  const prioritizedViolations = rankTopViolations(
    assessment.violations.map((violation) => ({
      type: violation.ruleId,
      source: violation.project,
      target: asString(violation.details?.target),
      severity: violation.severity,
      message: violation.message,
      ruleId: violation.ruleId,
    })),
    options.topViolations ?? 10
  );

  const domainCounts = new Map<string, number>();
  const layerCounts = new Map<string, number>();
  const fanoutCounts = new Map<string, number>();

  for (const project of assessment.workspace.projects) {
    if (project.domain) {
      domainCounts.set(
        project.domain,
        (domainCounts.get(project.domain) ?? 0) + 1
      );
    }

    if (project.layer) {
      layerCounts.set(project.layer, (layerCounts.get(project.layer) ?? 0) + 1);
    }
  }

  for (const dependency of assessment.workspace.dependencies) {
    fanoutCounts.set(
      dependency.source,
      (fanoutCounts.get(dependency.source) ?? 0) + 1
    );
  }

  const topProjectsLimit = Math.max(1, options.topProjects ?? 5);
  const topFanoutProjects = [...fanoutCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topProjectsLimit)
    .map(([project, count]) => ({ project, count }));

  const ownedProjectsCount = assessment.workspace.projects.filter((project) =>
    Boolean(project.ownership?.team)
  ).length;

  const request = buildOnboardingRequest({
    profile: options.profile ?? assessment.profile,
    dependencies: assessment.workspace.dependencies,
    topViolations: prioritizedViolations,
    metadata: {
      projectCount: assessment.workspace.projects.length,
      dependencyCount: assessment.workspace.dependencies.length,
      ownershipCoverage:
        assessment.workspace.projects.length > 0
          ? Number(
              (
                ownedProjectsCount / assessment.workspace.projects.length
              ).toFixed(3)
            )
          : 0,
      domainSummary: [...domainCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([domain, count]) => ({ domain, count })),
      layerSummary: [...layerCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([layer, count]) => ({ layer, count })),
      topFanoutProjects,
      analyzedViolations: prioritizedViolations.length,
      totalViolations: assessment.violations.length,
    },
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

async function buildAssessment(
  options: GovernanceRunOptions
): Promise<GovernanceAssessment> {
  const { assessment } = await buildAssessmentArtifacts(options);

  return assessment;
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

  const overrides = await loadProfileOverrides(workspaceRoot, profileName);
  const effectiveProfile: GovernanceProfile = {
    ...angularCleanupProfile,
    layers: overrides.layers ?? angularCleanupProfile.layers,
    allowedDomainDependencies:
      overrides.allowedDomainDependencies ??
      angularCleanupProfile.allowedDomainDependencies,
    ownership: {
      ...angularCleanupProfile.ownership,
      ...(overrides.ownership ?? {}),
    },
    health: {
      statusThresholds: {
        ...angularCleanupProfile.health.statusThresholds,
        ...(overrides.health?.statusThresholds ?? {}),
      },
    },
    metrics: {
      ...angularCleanupProfile.metrics,
      ...normalizeMetricWeights(overrides.metrics),
    },
  };

  const snapshot = await readNxWorkspaceSnapshot();
  const inventory = buildInventory(snapshot, overrides);
  const extensionRegistry = await registerGovernanceExtensions({
    workspaceRoot,
    profileName,
    options: { ...options },
    snapshot,
    inventory,
  });
  const enrichedInventory = await applyGovernanceEnrichers(extensionRegistry, {
    workspace: inventory,
    profile: effectiveProfile,
    context: {
      workspaceRoot,
      profileName,
      options: { ...options },
      snapshot,
      inventory,
    },
  });
  const coreViolations = evaluatePolicies(enrichedInventory, effectiveProfile);
  const resolvedConformanceInput = resolveConformanceInput(
    options.conformanceJson
  );
  const conformanceSnapshot = loadConformanceSnapshot(resolvedConformanceInput);
  const exceptionApplication = applyGovernanceExceptions({
    exceptions: overrides.exceptions,
    policyViolations: coreViolations,
    conformanceFindings: conformanceSnapshot?.findings ?? [],
    asOf: artifactsOptions.asOf ?? new Date(),
  });
  const extensionViolations = await evaluateGovernanceRulePacks(
    extensionRegistry,
    {
      workspace: enrichedInventory,
      profile: effectiveProfile,
      context: {
        workspaceRoot,
        profileName,
        options: { ...options },
        snapshot,
        inventory,
      },
    }
  );
  const allViolations = [
    ...exceptionApplication.activePolicyViolations,
    ...extensionViolations,
  ];
  const graphSignals = buildGraphSignals(
    toWorkspaceGraphSnapshot(enrichedInventory)
  );
  const policySignals = buildPolicySignals(
    exceptionApplication.activePolicyViolations
  );
  const conformanceSignals = buildConformanceSignalsForActiveFindings(
    conformanceSnapshot,
    exceptionApplication.activeConformanceFindings
  );
  const coreSignals = mergeGovernanceSignals(
    graphSignals,
    conformanceSignals,
    policySignals
  );
  const extensionSignals = await collectGovernanceSignals(extensionRegistry, {
    workspace: enrichedInventory,
    profile: effectiveProfile,
    violations: allViolations,
    signals: coreSignals,
    context: {
      workspaceRoot,
      profileName,
      options: { ...options },
      snapshot,
      inventory,
    },
  });
  const allSignals = mergeGovernanceSignals(coreSignals, extensionSignals);
  const coreMeasurements = calculateMetrics({
    workspace: enrichedInventory,
    signals: allSignals,
  });
  const extensionMeasurements = await collectGovernanceMeasurements(
    extensionRegistry,
    {
      workspace: enrichedInventory,
      profile: effectiveProfile,
      signals: allSignals,
      measurements: coreMeasurements,
      violations: allViolations,
      context: {
        workspaceRoot,
        profileName,
        options: { ...options },
        snapshot,
        inventory,
      },
    }
  );
  const allMeasurements = [...coreMeasurements, ...extensionMeasurements];
  const allTopIssues = buildTopIssues(allSignals);
  const filteredMeasurements = filterMeasurements(
    allMeasurements,
    options.reportType
  );
  const filteredSignals = filterSignalsForReportType(
    allSignals,
    options.reportType
  );
  const filteredViolations = filterViolations(
    allViolations,
    options.reportType
  );

  return {
    assessment: {
      workspace: enrichedInventory,
      profile: profileName,
      warnings: overrides.runtimeWarnings,
      exceptions: buildExceptionReport(exceptionApplication),
      violations: filteredViolations,
      measurements: filteredMeasurements,
      signalBreakdown: buildSignalBreakdown(filteredSignals),
      metricBreakdown: buildMetricBreakdown(filteredMeasurements),
      topIssues: buildTopIssues(filteredSignals),
      health: calculateHealthScore(
        allMeasurements,
        effectiveProfile.metrics,
        effectiveProfile.health.statusThresholds,
        {
          topIssues: allTopIssues,
        }
      ),
      recommendations: buildRecommendations(allViolations, allMeasurements),
    },
    signals: allSignals,
    exceptionApplication,
  };
}

function toWorkspaceGraphSnapshot(
  workspace: GovernanceWorkspace
): WorkspaceGraphSnapshot {
  const extractedAt = new Date().toISOString();

  return {
    source: 'nx-graph',
    extractedAt,
    projects: workspace.projects.map((project) => ({
      id: project.id,
      name: project.name,
      root: project.root,
      type: project.type === 'tool' ? 'unknown' : project.type,
      tags: project.tags,
      domain: project.domain,
      layer: project.layer,
    })),
    dependencies: workspace.dependencies.map((dependency) => ({
      sourceProjectId: dependency.source,
      targetProjectId: dependency.target,
      type: dependency.type,
    })),
  };
}

function filterViolations(
  violations: GovernanceAssessment['violations'],
  reportType: GovernanceRunOptions['reportType']
): GovernanceAssessment['violations'] {
  if (reportType === 'boundaries') {
    return violations.filter((violation) => violation.category === 'boundary');
  }

  if (reportType === 'ownership') {
    return violations.filter((violation) => violation.category === 'ownership');
  }

  if (reportType === 'architecture') {
    return violations.filter((violation) => violation.category !== 'ownership');
  }

  return violations;
}

function filterMeasurements(
  measurements: GovernanceAssessment['measurements'],
  reportType: GovernanceRunOptions['reportType']
): GovernanceAssessment['measurements'] {
  if (reportType === 'boundaries') {
    return measurements.filter(
      (measurement) => measurement.family === 'boundaries'
    );
  }

  if (reportType === 'ownership') {
    return measurements.filter(
      (measurement) => measurement.family === 'ownership'
    );
  }

  if (reportType === 'architecture') {
    return measurements.filter(
      (measurement) =>
        measurement.family !== 'ownership' &&
        measurement.family !== 'documentation'
    );
  }

  return measurements;
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

function buildConformanceSignalsForActiveFindings(
  snapshot: ConformanceSnapshot | undefined,
  findings: ConformanceSnapshot['findings']
) {
  if (!snapshot) {
    return [];
  }

  return buildConformanceSignals({
    ...snapshot,
    findings,
  });
}

function resolveSnapshotPath(
  explicitPath: string | undefined,
  fallbackPath: string | undefined
): string | undefined {
  if (!explicitPath) {
    return fallbackPath;
  }

  return path.isAbsolute(explicitPath)
    ? explicitPath
    : path.resolve(workspaceRoot, explicitPath);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error.';
}

function renderDriftCliReport(
  comparison: SnapshotComparison,
  signals: DriftSignal[],
  summary: DriftSummary
): string {
  const lines: string[] = [];
  lines.push('Nx Governance Drift Analysis');
  lines.push('');
  lines.push(`Baseline: ${comparison.baseline.timestamp}`);
  lines.push(`Current: ${comparison.current.timestamp}`);
  lines.push(
    `Violation delta: +${comparison.newViolations.length} / -${comparison.resolvedViolations.length}`
  );
  lines.push(`Overall trend: ${formatDriftStatus(summary.overallTrend)}`);

  if (
    comparison.healthDelta &&
    (comparison.healthDelta.baselineStatus !==
      comparison.healthDelta.currentStatus ||
      comparison.healthDelta.baselineGrade !==
        comparison.healthDelta.currentGrade)
  ) {
    lines.push(
      `Health transition: ${formatDriftStatus(
        comparison.healthDelta.baselineStatus
      )} (${comparison.healthDelta.baselineGrade}) -> ${formatDriftStatus(
        comparison.healthDelta.currentStatus
      )} (${comparison.healthDelta.currentGrade})`
    );
  }

  if (summary.topWorsening.length > 0) {
    lines.push('');
    lines.push('Top Worsening:');
    for (const signal of summary.topWorsening) {
      lines.push(
        `- ${signal.label}: ${formatDriftDelta(signal.delta)} (${
          signal.baseline
        } -> ${signal.current})`
      );
    }
  }

  if (summary.topImproving.length > 0) {
    lines.push('');
    lines.push('Top Improving:');
    for (const signal of summary.topImproving) {
      lines.push(
        `- ${signal.label}: ${formatDriftDelta(signal.delta)} (${
          signal.baseline
        } -> ${signal.current})`
      );
    }
  }

  if (signals.length > 0) {
    lines.push('');
    lines.push('Signals:');

    for (const signal of signals) {
      lines.push(
        `- ${signal.label}: ${signal.status} (${formatDriftDelta(
          signal.delta
        )}, magnitude ${signal.magnitude.toFixed(3)})`
      );
    }
  }

  return lines.join('\n');
}

function renderAiRootCauseCliReport(
  analysis: AiAnalysisResult,
  snapshotPath: string,
  selectedViolations: number
): string {
  const lines: string[] = [];
  lines.push('Nx Governance AI Root Cause');
  lines.push('');
  lines.push(`Snapshot: ${snapshotPath}`);
  lines.push(`Prioritized violations: ${selectedViolations}`);
  lines.push('');
  lines.push(`Summary: ${analysis.summary}`);

  if (analysis.findings.length > 0) {
    lines.push('');
    lines.push('Findings:');
    for (const finding of analysis.findings) {
      lines.push(`- ${finding.title}: ${finding.detail}`);
    }
  }

  if (analysis.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const recommendation of analysis.recommendations) {
      lines.push(
        `- (${recommendation.priority}) ${recommendation.title} - ${recommendation.reason}`
      );
    }
  }

  return lines.join('\n');
}

function summarizeDriftInterpretation(
  request: AiAnalysisRequest,
  signals: DriftSignal[],
  summary: DriftSummary
): AiAnalysisResult {
  const findings = signals.map((signal) => ({
    id: `drift-${signal.id}`,
    title: signal.label,
    detail: `Status is ${signal.status} with delta ${formatDriftDelta(
      signal.delta
    )} and magnitude ${signal.magnitude.toFixed(3)}.`,
    signals: ['drift-analysis', 'snapshot-comparison'],
    confidence: 1,
  }));

  const recommendations: AiAnalysisResult['recommendations'] = [
    {
      id: 'drift-review-regressing-signals',
      title: 'Review Regressing Signals First',
      priority: summary.worseningCount > 0 ? 'high' : 'low',
      reason:
        summary.worseningCount > 0
          ? `There are ${summary.worseningCount} worsening drift signals. Prioritize investigation of those signals before broader refactoring.`
          : 'No worsening drift signals were detected in this comparison window.',
    },
    {
      id: 'drift-validate-trend-window',
      title: 'Validate Trend Window Confidence',
      priority: 'medium',
      reason:
        request.inputs.metadata &&
        typeof request.inputs.metadata['trendWindowInsufficient'] ===
          'boolean' &&
        request.inputs.metadata['trendWindowInsufficient']
          ? 'Fewer than four snapshots were available. Treat conclusions as provisional and continue collecting trend data.'
          : 'Trend window is sufficient for directional interpretation. Continue monitoring for persistence across future snapshots.',
    },
  ];

  return {
    kind: 'drift',
    summary: `Deterministic drift interpretation indicates a ${summary.overallTrend} trend (${summary.worseningCount} worsening, ${summary.improvingCount} improving, ${summary.stableCount} stable).`,
    findings,
    recommendations,
    metadata: {
      trend: summary.overallTrend,
      worseningCount: summary.worseningCount,
      improvingCount: summary.improvingCount,
      stableCount: summary.stableCount,
      signalCount: signals.length,
      topWorsening: summary.topWorsening,
      topImproving: summary.topImproving,
      ...request.inputs.metadata,
    },
  };
}

function renderAiDriftCliReport(analysis: AiAnalysisResult): string {
  const lines: string[] = [];
  lines.push('Nx Governance AI Drift Interpretation');
  lines.push('');
  lines.push(`Summary: ${analysis.summary}`);

  if (analysis.findings.length > 0) {
    lines.push('');
    lines.push('Findings:');
    for (const finding of analysis.findings) {
      lines.push(`- ${finding.title}: ${finding.detail}`);
    }
  }

  if (analysis.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const recommendation of analysis.recommendations) {
      lines.push(
        `- (${recommendation.priority}) ${recommendation.title} - ${recommendation.reason}`
      );
    }
  }

  return lines.join('\n');
}

function formatDriftStatus(status: string): string {
  return status[0]?.toUpperCase() + status.slice(1);
}

function formatDriftDelta(delta: number): string {
  return `${delta > 0 ? '+' : ''}${delta.toFixed(3)}`;
}

function renderAiPrImpactCliReport(analysis: AiAnalysisResult): string {
  const lines: string[] = [];
  lines.push('Nx Governance AI PR Impact');
  lines.push('');
  lines.push(`Summary: ${analysis.summary}`);

  if (analysis.findings.length > 0) {
    lines.push('');
    lines.push('Findings:');
    for (const finding of analysis.findings) {
      lines.push(`- ${finding.title}: ${finding.detail}`);
    }
  }

  if (analysis.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const recommendation of analysis.recommendations) {
      lines.push(
        `- (${recommendation.priority}) ${recommendation.title} - ${recommendation.reason}`
      );
    }
  }

  return lines.join('\n');
}

function renderAiCognitiveLoadCliReport(analysis: AiAnalysisResult): string {
  const lines: string[] = [];
  lines.push('Nx Governance AI Cognitive Load');
  lines.push('');
  lines.push(`Summary: ${analysis.summary}`);

  if (analysis.findings.length > 0) {
    lines.push('');
    lines.push('Signals:');
    for (const finding of analysis.findings) {
      lines.push(`- ${finding.title}: ${finding.detail}`);
    }
  }

  if (analysis.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const recommendation of analysis.recommendations) {
      lines.push(
        `- (${recommendation.priority}) ${recommendation.title} - ${recommendation.reason}`
      );
    }
  }

  return lines.join('\n');
}

function renderAiRecommendationsCliReport(analysis: AiAnalysisResult): string {
  const lines: string[] = [];
  lines.push('Nx Governance AI Recommendations');
  lines.push('');
  lines.push(`Summary: ${analysis.summary}`);

  if (analysis.findings.length > 0) {
    lines.push('');
    lines.push('Findings:');
    for (const finding of analysis.findings) {
      lines.push(`- ${finding.title}: ${finding.detail}`);
    }
  }

  if (analysis.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const recommendation of analysis.recommendations) {
      lines.push(
        `- (${recommendation.priority}) ${recommendation.title} - ${recommendation.reason}`
      );
    }
  }

  return lines.join('\n');
}

function renderAiSmellClustersCliReport(analysis: AiAnalysisResult): string {
  const lines: string[] = [];
  lines.push('Nx Governance AI Smell Clusters');
  lines.push('');
  lines.push(`Summary: ${analysis.summary}`);

  if (analysis.findings.length > 0) {
    lines.push('');
    lines.push('Findings:');
    for (const finding of analysis.findings) {
      lines.push(`- ${finding.title}: ${finding.detail}`);
    }
  }

  if (analysis.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const recommendation of analysis.recommendations) {
      lines.push(
        `- (${recommendation.priority}) ${recommendation.title} - ${recommendation.reason}`
      );
    }
  }

  return lines.join('\n');
}

function renderAiRefactoringSuggestionsCliReport(
  analysis: AiAnalysisResult
): string {
  const lines: string[] = [];
  lines.push('Nx Governance AI Refactoring Suggestions');
  lines.push('');
  lines.push(`Summary: ${analysis.summary}`);

  if (analysis.findings.length > 0) {
    lines.push('');
    lines.push('Findings:');
    for (const finding of analysis.findings) {
      lines.push(`- ${finding.title}: ${finding.detail}`);
    }
  }

  if (analysis.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const recommendation of analysis.recommendations) {
      lines.push(
        `- (${recommendation.priority}) ${recommendation.title} - ${recommendation.reason}`
      );
    }
  }

  return lines.join('\n');
}

function renderAiScorecardCliReport(analysis: AiAnalysisResult): string {
  const lines: string[] = [];
  lines.push('Nx Governance AI Scorecard');
  lines.push('');
  lines.push(`Summary: ${analysis.summary}`);

  if (analysis.findings.length > 0) {
    lines.push('');
    lines.push('Findings:');
    for (const finding of analysis.findings) {
      lines.push(`- ${finding.title}: ${finding.detail}`);
    }
  }

  if (analysis.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const recommendation of analysis.recommendations) {
      lines.push(
        `- (${recommendation.priority}) ${recommendation.title} - ${recommendation.reason}`
      );
    }
  }

  return lines.join('\n');
}

function renderAiOnboardingCliReport(analysis: AiAnalysisResult): string {
  const lines: string[] = [];
  lines.push('Nx Governance AI Onboarding');
  lines.push('');
  lines.push(`Summary: ${analysis.summary}`);

  if (analysis.findings.length > 0) {
    lines.push('');
    lines.push('Findings:');
    for (const finding of analysis.findings) {
      lines.push(`- ${finding.title}: ${finding.detail}`);
    }
  }

  if (analysis.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const recommendation of analysis.recommendations) {
      lines.push(
        `- (${recommendation.priority}) ${recommendation.title} - ${recommendation.reason}`
      );
    }
  }

  return lines.join('\n');
}

function readChangedFiles(baseRef: string, headRef: string): string[] {
  try {
    const output = execFileSync(
      'git',
      ['diff', '--name-only', `${baseRef}...${headRef}`],
      {
        cwd: workspaceRoot,
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    )
      .toString()
      .trim();

    if (!output) {
      return [];
    }

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function resolveAffectedProjects(
  assessment: GovernanceAssessment,
  changedFiles: string[]
): GovernanceAssessment['workspace']['projects'] {
  if (changedFiles.length === 0) {
    return [];
  }

  const changedSet = new Set(changedFiles);

  return assessment.workspace.projects.filter((project) => {
    const normalizedRoot = project.root.replace(/\\/g, '/').replace(/\/+$/, '');

    for (const filePath of changedSet) {
      const normalizedPath = filePath.replace(/\\/g, '/');
      if (
        normalizedPath === normalizedRoot ||
        normalizedPath.startsWith(`${normalizedRoot}/`)
      ) {
        return true;
      }
    }

    return false;
  });
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function sliceDependenciesForProjectScope(
  dependencies: GovernanceDependency[],
  projectScope: Set<string>,
  limit: number
): { items: GovernanceDependency[]; truncation: TruncationMetadata } {
  const filtered = dependencies.filter(
    (dependency) =>
      projectScope.has(dependency.source) || projectScope.has(dependency.target)
  );

  const sorted = [...filtered].sort(
    (a, b) =>
      a.source.localeCompare(b.source) ||
      a.target.localeCompare(b.target) ||
      a.type.localeCompare(b.type)
  );

  const items = sorted.slice(0, Math.max(0, limit));
  return {
    items,
    truncation: buildTruncationMetadata(sorted.length, items.length, limit),
  };
}

interface TruncationMetadata {
  totalCount: number;
  selectedCount: number;
  limit: number;
  truncated: boolean;
}

function buildTruncationMetadata(
  totalCount: number,
  selectedCount: number,
  limit: number
): TruncationMetadata {
  return {
    totalCount,
    selectedCount,
    limit,
    truncated: selectedCount < totalCount,
  };
}

function sliceTopItems<T>(
  items: T[],
  limit: number,
  compare: (a: T, b: T) => number
): { items: T[]; truncation: TruncationMetadata } {
  const sorted = [...items].sort(compare);
  const selected = sorted.slice(0, Math.max(0, limit));

  return {
    items: selected,
    truncation: buildTruncationMetadata(sorted.length, selected.length, limit),
  };
}

function compareViolationsForPriority(
  a: SnapshotViolation,
  b: SnapshotViolation
): number {
  const severityRank = (severity?: SnapshotViolation['severity']): number => {
    if (severity === 'error') return 3;
    if (severity === 'warning') return 2;
    if (severity === 'info') return 1;
    return 0;
  };

  return (
    severityRank(b.severity) - severityRank(a.severity) ||
    (a.source ?? '').localeCompare(b.source ?? '') ||
    (a.type ?? '').localeCompare(b.type ?? '') ||
    (a.target ?? '').localeCompare(b.target ?? '')
  );
}

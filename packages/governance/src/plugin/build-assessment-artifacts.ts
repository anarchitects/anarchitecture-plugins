import { workspaceRoot } from '@nx/devkit';

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
import { buildMetricBreakdown } from '../reporting/metric-breakdown.js';
import {
  buildSignalBreakdown,
  filterSignalsForReportType,
} from '../reporting/signal-breakdown.js';
import { buildTopIssues } from '../reporting/top-issues.js';
import { readConformanceSnapshot } from '../conformance-adapter/conformance-adapter.js';
import { GovernanceWorkspace } from '../core/index.js';
import { resolveConformanceInput } from './resolve-conformance-input.js';
import {
  buildConformanceSignals,
  buildGraphSignals,
  buildPolicySignals,
  GovernanceSignal,
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

export interface GovernanceAssessmentBuildOptions {
  profile?: string;
  conformanceJson?: string;
  reportType?: 'health' | 'boundaries' | 'ownership' | 'architecture';
}

export interface GovernanceAssessmentArtifacts {
  assessment: GovernanceAssessment;
  signals: GovernanceSignal[];
}

export async function buildGovernanceAssessmentArtifacts(
  options: GovernanceAssessmentBuildOptions = {}
): Promise<GovernanceAssessmentArtifacts> {
  const profileName = options.profile ?? 'angular-cleanup';

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
  const context = {
    workspaceRoot,
    profileName,
    options: { ...options },
    snapshot,
    inventory,
  };
  const extensionRegistry = await registerGovernanceExtensions(context);
  const enrichedInventory = await applyGovernanceEnrichers(extensionRegistry, {
    workspace: inventory,
    profile: effectiveProfile,
    context,
  });
  const coreViolations = evaluatePolicies(enrichedInventory, effectiveProfile);
  const extensionViolations = await evaluateGovernanceRulePacks(
    extensionRegistry,
    {
      workspace: enrichedInventory,
      profile: effectiveProfile,
      context,
    }
  );
  const allViolations = [...coreViolations, ...extensionViolations];
  const graphSignals = buildGraphSignals(
    toWorkspaceGraphSnapshot(enrichedInventory)
  );
  const policySignals = buildPolicySignals(allViolations);
  const resolvedConformanceInput = resolveConformanceInput(
    options.conformanceJson
  );
  const conformanceSignals = loadConformanceSignals(resolvedConformanceInput);
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
    context,
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
      context,
    }
  );
  const allMeasurements = [...coreMeasurements, ...extensionMeasurements];
  const filteredSignals = filterSignalsForReportType(
    allSignals,
    options.reportType
  );
  const filteredMeasurements = filterMeasurements(
    allMeasurements,
    options.reportType
  );
  const filteredViolations = filterViolations(
    allViolations,
    options.reportType
  );
  const allTopIssues = buildTopIssues(allSignals);

  return {
    assessment: {
      workspace: enrichedInventory,
      profile: profileName,
      warnings: overrides.runtimeWarnings,
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
    signals: filteredSignals,
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
  reportType: GovernanceAssessmentBuildOptions['reportType']
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
  reportType: GovernanceAssessmentBuildOptions['reportType']
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

function loadConformanceSignals(
  input: ReturnType<typeof resolveConformanceInput>
) {
  if (!input.conformanceJson) {
    return [];
  }

  try {
    return buildConformanceSignals(
      readConformanceSnapshot({ conformanceJson: input.conformanceJson })
    );
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

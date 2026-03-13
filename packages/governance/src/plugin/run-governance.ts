import { logger, workspaceRoot } from '@nx/devkit';

import { GovernanceAssessment } from '../core/index.js';
import {
  buildRecommendations,
  calculateHealthScore,
  MetricWeights,
} from '../health-engine/calculate-health.js';
import { buildInventory } from '../inventory/build-inventory.js';
import { calculateMetrics } from '../metric-engine/calculate-metrics.js';
import { readNxWorkspaceSnapshot } from '../nx-adapter/read-workspace.js';
import { evaluatePolicies } from '../policy-engine/evaluate-policies.js';
import {
  angularCleanupProfile,
    loadProfileOverrides,
} from '../presets/angular-cleanup/profile.js';
import { renderCliReport } from '../reporting/render-cli.js';
import { renderJsonReport } from '../reporting/render-json.js';

export interface GovernanceRunOptions {
  profile?: string;
  output?: 'cli' | 'json';
  failOnViolation?: boolean;
  reportType?: 'health' | 'boundaries' | 'ownership' | 'architecture';
}

export interface GovernanceRunResult {
  assessment: GovernanceAssessment;
  rendered: string;
  success: boolean;
}

export async function runGovernance(
  options: GovernanceRunOptions = {}
): Promise<GovernanceRunResult> {
  const profileName = options.profile ?? 'angular-cleanup';

  const overrides = await loadProfileOverrides(workspaceRoot, profileName);
  const effectiveProfile = {
    ...angularCleanupProfile,
    layers: overrides.layers ?? angularCleanupProfile.layers,
    allowedDomainDependencies:
      overrides.allowedDomainDependencies ??
      angularCleanupProfile.allowedDomainDependencies,
    ownership: {
      ...angularCleanupProfile.ownership,
      ...(overrides.ownership ?? {}),
    },
    metrics: {
      ...angularCleanupProfile.metrics,
      ...(overrides.metrics ?? {}),
    },
  };

  const snapshot = await readNxWorkspaceSnapshot();
  const inventory = buildInventory(snapshot, overrides);
  const allViolations = evaluatePolicies(inventory, effectiveProfile);
  const allMeasurements = calculateMetrics(inventory, allViolations);

  const assessment: GovernanceAssessment = {
    workspace: inventory,
    profile: profileName,
    warnings: overrides.runtimeWarnings,
    violations: filterViolations(allViolations, options.reportType),
    measurements: filterMeasurements(allMeasurements, options.reportType),
    health: calculateHealthScore(
      allMeasurements,
      metricWeightsFromProfile(effectiveProfile.metrics)
    ),
    recommendations: buildRecommendations(allViolations, allMeasurements),
  };

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

function metricWeightsFromProfile(metrics: {
  architecturalEntropyWeight: number;
  dependencyComplexityWeight: number;
  domainIntegrityWeight: number;
  ownershipCoverageWeight: number;
  documentationCompletenessWeight: number;
}): MetricWeights {
  return {
    'architectural-entropy': metrics.architecturalEntropyWeight,
    'dependency-complexity': metrics.dependencyComplexityWeight,
    'domain-integrity': metrics.domainIntegrityWeight,
    'ownership-coverage': metrics.ownershipCoverageWeight,
    'documentation-completeness': metrics.documentationCompletenessWeight,
  };
}

function filterViolations(
  violations: GovernanceAssessment['violations'],
  reportType: GovernanceRunOptions['reportType']
): GovernanceAssessment['violations'] {
  if (reportType === 'boundaries') {
    return violations.filter(
      (violation) =>
        violation.ruleId === 'domain-boundary' ||
        violation.ruleId === 'layer-boundary'
    );
  }

  if (reportType === 'ownership') {
    return violations.filter(
      (violation) => violation.ruleId === 'ownership-presence'
    );
  }

  if (reportType === 'architecture') {
    return violations.filter((violation) => violation.ruleId !== 'ownership-presence');
  }

  return violations;
}

function filterMeasurements(
  measurements: GovernanceAssessment['measurements'],
  reportType: GovernanceRunOptions['reportType']
): GovernanceAssessment['measurements'] {
  if (reportType === 'boundaries') {
    return measurements.filter((measurement) =>
      ['architectural-entropy', 'domain-integrity', 'layer-integrity'].includes(
        measurement.id
      )
    );
  }

  if (reportType === 'ownership') {
    return measurements.filter((measurement) => measurement.id === 'ownership-coverage');
  }

  if (reportType === 'architecture') {
    return measurements.filter((measurement) =>
      ['architectural-entropy', 'dependency-complexity', 'domain-integrity'].includes(
        measurement.id
      )
    );
  }

  return measurements;
}

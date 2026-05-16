import type {
  GovernanceAssessment,
  GovernanceMetricFamily,
  GovernanceTopIssue,
  Measurement,
  SnapshotComparison,
  SnapshotMetricFamilyDelta,
  SnapshotTopIssueDelta,
  Violation,
} from '../core/index.js';
import type { GovernanceInsightDriver } from './models.js';

export interface MapGovernanceDriversInput {
  assessment: GovernanceAssessment;
  comparison?: SnapshotComparison;
}

type GovernanceDriverTrend = GovernanceInsightDriver['trend'];
type IssueLike = {
  type: string;
  ruleId?: string;
  message: string;
};

const DRIVER_ORDER = [
  'cross-domain-coordination-friction',
  'architectural-erosion-risk',
  'ownership-ambiguity',
  'change-impact-radius-pressure',
  'cost-of-change-pressure',
  'onboarding-friction',
  'delivery-predictability-pressure',
  'architecture-investment-priority',
] as const;

export function mapGovernanceDrivers(
  input: MapGovernanceDriversInput
): GovernanceInsightDriver[] {
  const { assessment, comparison } = input;
  const measurementsById = new Map(
    assessment.measurements.map((measurement) => [measurement.id, measurement])
  );

  const drivers = [
    buildCrossDomainCoordinationDriver(assessment, comparison, measurementsById),
    buildArchitecturalErosionDriver(assessment, comparison, measurementsById),
    buildOwnershipAmbiguityDriver(assessment, comparison, measurementsById),
    buildChangeImpactRadiusDriver(assessment, comparison, measurementsById),
    buildCostOfChangeDriver(assessment, comparison, measurementsById),
    buildOnboardingFrictionDriver(assessment, comparison, measurementsById),
    buildDeliveryPredictabilityDriver(assessment, comparison),
    buildArchitectureInvestmentPriorityDriver(assessment, comparison),
  ].filter((driver): driver is GovernanceInsightDriver => driver !== undefined);

  return [...drivers].sort(
    (left, right) =>
      DRIVER_ORDER.indexOf(left.id as (typeof DRIVER_ORDER)[number]) -
      DRIVER_ORDER.indexOf(right.id as (typeof DRIVER_ORDER)[number])
  );
}

function buildCrossDomainCoordinationDriver(
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined,
  measurementsById: Map<string, Measurement>
): GovernanceInsightDriver | undefined {
  const measurement = measurementsById.get('domain-integrity');
  const topIssues = assessment.topIssues.filter(isCrossDomainTopIssue);
  const violations = assessment.violations.filter(isCrossDomainViolation);

  if (!hasMeasurementPressure(measurement) && topIssues.length === 0 && violations.length === 0) {
    return undefined;
  }

  return buildMeasurementBackedDriver({
    id: 'cross-domain-coordination-friction',
    label: 'Cross-domain coordination friction',
    measurement,
    fallbackCount: getPrimaryIssueCount(topIssues, violations),
    trend:
      deriveIssueTrend(
        getTopIssueDeltaTotal(comparison?.topIssueDeltas, isCrossDomainTopIssueDelta)
      ) ??
      deriveMetricFamilyTrend(
        findMetricFamilyDelta(comparison, 'boundaries')
      ),
    explanation: buildMeasurementExplanation({
      measurement,
      issueCount: getPrimaryIssueCount(topIssues, violations),
      issueLabel: 'cross-domain boundary issue',
      fallbackLabel: 'Cross-domain boundary pressure is present in current governance findings.',
    }),
  });
}

function buildArchitecturalErosionDriver(
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined,
  measurementsById: Map<string, Measurement>
): GovernanceInsightDriver | undefined {
  const measurement = measurementsById.get('layer-integrity');
  const topIssues = assessment.topIssues.filter(isLayerBoundaryTopIssue);
  const violations = assessment.violations.filter(isLayerBoundaryViolation);

  if (!hasMeasurementPressure(measurement) && topIssues.length === 0 && violations.length === 0) {
    return undefined;
  }

  return buildMeasurementBackedDriver({
    id: 'architectural-erosion-risk',
    label: 'Architectural erosion / change safety risk',
    measurement,
    fallbackCount: getPrimaryIssueCount(topIssues, violations),
    trend:
      deriveIssueTrend(
        getTopIssueDeltaTotal(comparison?.topIssueDeltas, isLayerBoundaryTopIssueDelta)
      ) ??
      deriveMetricFamilyTrend(
        findMetricFamilyDelta(comparison, 'boundaries')
      ),
    explanation: buildMeasurementExplanation({
      measurement,
      issueCount: getPrimaryIssueCount(topIssues, violations),
      issueLabel: 'layer boundary issue',
      fallbackLabel: 'Layer boundary pressure is present in current governance findings.',
    }),
  });
}

function buildOwnershipAmbiguityDriver(
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined,
  measurementsById: Map<string, Measurement>
): GovernanceInsightDriver | undefined {
  const measurement = measurementsById.get('ownership-coverage');
  const topIssues = assessment.topIssues.filter(isOwnershipTopIssue);
  const violations = assessment.violations.filter(isOwnershipViolation);

  if (!hasMeasurementPressure(measurement) && topIssues.length === 0 && violations.length === 0) {
    return undefined;
  }

  return buildMeasurementBackedDriver({
    id: 'ownership-ambiguity',
    label: 'Ownership ambiguity',
    measurement,
    fallbackCount: getPrimaryIssueCount(topIssues, violations),
    trend:
      deriveIssueTrend(
        getTopIssueDeltaTotal(comparison?.topIssueDeltas, isOwnershipTopIssueDelta)
      ) ??
      deriveMetricFamilyTrend(
        findMetricFamilyDelta(comparison, 'ownership')
      ),
    explanation: buildMeasurementExplanation({
      measurement,
      issueCount: getPrimaryIssueCount(topIssues, violations),
      issueLabel: 'ownership issue',
      fallbackLabel: 'Ownership ambiguity is present in current governance findings.',
    }),
  });
}

function buildChangeImpactRadiusDriver(
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined,
  measurementsById: Map<string, Measurement>
): GovernanceInsightDriver | undefined {
  const measurement = measurementsById.get('dependency-complexity');
  const topIssues = assessment.topIssues.filter(isDependencyTopIssue);
  const violations = assessment.violations.filter(isDependencyViolation);

  if (!hasMeasurementPressure(measurement) && topIssues.length === 0 && violations.length === 0) {
    return undefined;
  }

  return buildMeasurementBackedDriver({
    id: 'change-impact-radius-pressure',
    label: 'Impact radius / blast radius pressure',
    measurement,
    fallbackCount: getPrimaryIssueCount(topIssues, violations),
    trend:
      deriveIssueTrend(
        getTopIssueDeltaTotal(comparison?.topIssueDeltas, isDependencyTopIssueDelta)
      ) ??
      deriveMetricFamilyTrend(
        findMetricFamilyDelta(comparison, 'architecture')
      ),
    explanation: buildMeasurementExplanation({
      measurement,
      issueCount: getPrimaryIssueCount(topIssues, violations),
      issueLabel: 'dependency hotspot',
      fallbackLabel: 'Dependency coupling pressure is present in current governance findings.',
    }),
  });
}

function buildCostOfChangeDriver(
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined,
  measurementsById: Map<string, Measurement>
): GovernanceInsightDriver | undefined {
  const measurement = measurementsById.get('architectural-entropy');
  const topIssues = assessment.topIssues.filter(isCostOfChangeTopIssue);
  const violations = assessment.violations.filter(isCostOfChangeViolation);

  if (!hasMeasurementPressure(measurement) && topIssues.length === 0 && violations.length === 0) {
    return undefined;
  }

  return buildMeasurementBackedDriver({
    id: 'cost-of-change-pressure',
    label: 'Cost-of-change pressure',
    measurement,
    fallbackCount: getPrimaryIssueCount(topIssues, violations),
    trend: deriveMetricFamilyTrend(findMetricFamilyDelta(comparison, 'architecture')),
    explanation: buildMeasurementExplanation({
      measurement,
      issueCount: getPrimaryIssueCount(topIssues, violations),
      issueLabel: 'architectural drift issue',
      fallbackLabel: 'Architectural entropy pressure is present in current governance findings.',
    }),
  });
}

function buildOnboardingFrictionDriver(
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined,
  measurementsById: Map<string, Measurement>
): GovernanceInsightDriver | undefined {
  const measurement = measurementsById.get('documentation-completeness');
  const violations = assessment.violations.filter(isDocumentationViolation);

  if (!hasMeasurementPressure(measurement) && violations.length === 0) {
    return undefined;
  }

  return buildMeasurementBackedDriver({
    id: 'onboarding-friction',
    label: 'Knowledge transfer / onboarding friction',
    measurement,
    fallbackCount: violations.length,
    trend: deriveMetricFamilyTrend(findMetricFamilyDelta(comparison, 'documentation')),
    explanation: buildMeasurementExplanation({
      measurement,
      issueCount: violations.length,
      issueLabel: 'documentation gap',
      fallbackLabel: 'Documentation gaps are present in current governance findings.',
    }),
  });
}

function buildDeliveryPredictabilityDriver(
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined
): GovernanceInsightDriver | undefined {
  const health = assessment.health;
  const trend = deriveHealthTrend(comparison);

  if (health.status === 'good' && trend !== 'worsening') {
    return undefined;
  }

  return {
    id: 'delivery-predictability-pressure',
    label: 'Delivery predictability pressure',
    value: health.score,
    score: health.score,
    unit: 'score',
    trend,
    explanation: `Health score is ${health.score} with ${health.status} status.`,
  };
}

function buildArchitectureInvestmentPriorityDriver(
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined
): GovernanceInsightDriver | undefined {
  if (assessment.topIssues.length === 0) {
    return undefined;
  }

  const totalCount = assessment.topIssues.reduce(
    (sum, issue) => sum + issue.count,
    0
  );

  const headline = assessment.topIssues
    .slice(0, 2)
    .map((issue) => `${issue.message} (x${issue.count})`)
    .join('; ');

  return {
    id: 'architecture-investment-priority',
    label: 'Prioritized architecture investment drivers',
    value: totalCount,
    unit: 'count',
    trend: deriveIssueTrend(
      getTopIssueDeltaTotal(comparison?.topIssueDeltas, () => true)
    ),
    explanation:
      headline.length > 0
        ? `Top issues are led by ${headline}.`
        : 'Top governance issues are available for prioritized follow-up.',
  };
}

function buildMeasurementBackedDriver(input: {
  id: GovernanceInsightDriver['id'];
  label: string;
  measurement: Measurement | undefined;
  fallbackCount: number;
  trend: GovernanceDriverTrend | undefined;
  explanation: string;
}): GovernanceInsightDriver {
  const { measurement, fallbackCount } = input;

  return {
    id: input.id,
    label: input.label,
    value: measurement?.value ?? fallbackCount,
    score: measurement?.score,
    unit: measurement?.unit ?? 'count',
    trend: input.trend,
    explanation: input.explanation,
  };
}

function buildMeasurementExplanation(input: {
  measurement: Measurement | undefined;
  issueCount: number;
  issueLabel: string;
  fallbackLabel: string;
}): string {
  const { measurement, issueCount, issueLabel, fallbackLabel } = input;

  if (measurement && issueCount > 0) {
    return `${measurement.name} score is ${measurement.score} with ${issueCount} ${pluralize(issueLabel, issueCount)}.`;
  }

  if (measurement) {
    return `${measurement.name} score is ${measurement.score}.`;
  }

  if (issueCount > 0) {
    return `${issueCount} ${pluralize(issueLabel, issueCount)} ${issueCount === 1 ? 'is' : 'are'} present in current governance findings.`;
  }

  return fallbackLabel;
}

function hasMeasurementPressure(measurement: Measurement | undefined): boolean {
  return measurement !== undefined && measurement.score < measurement.maxScore;
}

function getPrimaryIssueCount(
  topIssues: GovernanceTopIssue[],
  violations: Violation[]
): number {
  const topIssueCount = topIssues.reduce((sum, issue) => sum + issue.count, 0);

  return topIssueCount > 0 ? topIssueCount : violations.length;
}

function deriveIssueTrend(
  delta: number | undefined
): GovernanceDriverTrend | undefined {
  if (delta === undefined) {
    return undefined;
  }

  if (delta > 0) {
    return 'worsening';
  }

  if (delta < 0) {
    return 'improving';
  }

  return 'stable';
}

function deriveMetricFamilyTrend(
  delta: SnapshotMetricFamilyDelta | undefined
): GovernanceDriverTrend | undefined {
  if (!delta) {
    return undefined;
  }

  if (delta.delta < 0) {
    return 'worsening';
  }

  if (delta.delta > 0) {
    return 'improving';
  }

  return 'stable';
}

function deriveHealthTrend(
  comparison: SnapshotComparison | undefined
): GovernanceDriverTrend | undefined {
  const delta = comparison?.healthDelta?.scoreDelta;

  if (delta === undefined) {
    return undefined;
  }

  if (delta < 0) {
    return 'worsening';
  }

  if (delta > 0) {
    return 'improving';
  }

  return 'stable';
}

function findMetricFamilyDelta(
  comparison: SnapshotComparison | undefined,
  family: GovernanceMetricFamily
): SnapshotMetricFamilyDelta | undefined {
  return comparison?.metricFamilyDeltas?.find((delta) => delta.family === family);
}

function getTopIssueDeltaTotal(
  deltas: SnapshotTopIssueDelta[] | undefined,
  predicate: (delta: SnapshotTopIssueDelta) => boolean
): number | undefined {
  const matching = deltas?.filter(predicate) ?? [];

  if (matching.length === 0) {
    return undefined;
  }

  return matching.reduce((sum, delta) => sum + delta.delta, 0);
}

function isCrossDomainTopIssue(issue: IssueLike): boolean {
  return (
    issue.type === 'domain-boundary-violation' ||
    issue.type === 'cross-domain-dependency' ||
    matchesAnyText(getIssueText(issue), ['cross-domain', 'domain boundary'])
  );
}

function isLayerBoundaryTopIssue(issue: IssueLike): boolean {
  return (
    issue.type === 'layer-boundary-violation' ||
    matchesAnyText(getIssueText(issue), ['layer boundary', 'layering'])
  );
}

function isOwnershipTopIssue(issue: IssueLike): boolean {
  return (
    issue.type === 'ownership-gap' ||
    matchesAnyText(getIssueText(issue), ['ownership'])
  );
}

function isDependencyTopIssue(issue: IssueLike): boolean {
  return (
    issue.type === 'structural-dependency' ||
    issue.type === 'circular-dependency' ||
    matchesAnyText(getIssueText(issue), [
      'coupling',
      'fanout',
      'blast radius',
      'circular',
    ])
  );
}

function isCostOfChangeTopIssue(issue: IssueLike): boolean {
  return matchesAnyText(getIssueText(issue), ['entropy', 'erosion', 'drift']);
}

function isCrossDomainViolation(violation: Violation): boolean {
  return (
    violation.category === 'boundary' &&
    matchesAnyText(getViolationText(violation), [
      'cross-domain',
      'domain boundary',
      'domain-boundary',
    ])
  );
}

function isLayerBoundaryViolation(violation: Violation): boolean {
  return (
    violation.category === 'boundary' &&
    matchesAnyText(getViolationText(violation), [
      'layer boundary',
      'layer-boundary',
      'layering',
    ])
  );
}

function isOwnershipViolation(violation: Violation): boolean {
  return (
    violation.category === 'ownership' ||
    matchesAnyText(getViolationText(violation), ['ownership'])
  );
}

function isDependencyViolation(violation: Violation): boolean {
  return (
    violation.category === 'dependency' ||
    matchesAnyText(getViolationText(violation), [
      'coupling',
      'fanout',
      'blast radius',
      'circular',
    ])
  );
}

function isCostOfChangeViolation(violation: Violation): boolean {
  return matchesAnyText(getViolationText(violation), [
    'entropy',
    'erosion',
    'drift',
  ]);
}

function isDocumentationViolation(violation: Violation): boolean {
  return (
    violation.category === 'documentation' ||
    matchesAnyText(getViolationText(violation), [
      'documentation',
      'docs',
      'onboarding',
    ])
  );
}

function isCrossDomainTopIssueDelta(delta: SnapshotTopIssueDelta): boolean {
  return isCrossDomainTopIssue(delta);
}

function isLayerBoundaryTopIssueDelta(delta: SnapshotTopIssueDelta): boolean {
  return isLayerBoundaryTopIssue(delta);
}

function isOwnershipTopIssueDelta(delta: SnapshotTopIssueDelta): boolean {
  return isOwnershipTopIssue(delta);
}

function isDependencyTopIssueDelta(delta: SnapshotTopIssueDelta): boolean {
  return isDependencyTopIssue(delta);
}

function getIssueText(issue: IssueLike): string {
  return `${issue.type} ${issue.ruleId ?? ''} ${issue.message}`.toLowerCase();
}

function getViolationText(violation: Violation): string {
  return `${violation.category} ${violation.ruleId} ${violation.message}`.toLowerCase();
}

function matchesAnyText(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

function pluralize(label: string, count: number): string {
  return count === 1 ? label : `${label}s`;
}

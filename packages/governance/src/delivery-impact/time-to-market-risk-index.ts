import type {
  GovernanceAssessment,
  Measurement,
  SnapshotComparison,
  SnapshotMetricDelta,
  Violation,
} from '../core/index.js';
import { mapGovernanceDrivers } from './map-governance-drivers.js';
import type {
  DeliveryImpactIndex,
  GovernanceInsightDriver,
} from './models.js';

export interface CalculateTimeToMarketRiskIndexInput {
  assessment: GovernanceAssessment;
  comparison?: SnapshotComparison;
  drivers?: GovernanceInsightDriver[];
}

export const DEFAULT_TIME_TO_MARKET_RISK_WEIGHTS = {
  crossDomainCoordination: 0.25,
  ownershipCoverage: 0.2,
  dependencyComplexity: 0.15,
  layerIntegrity: 0.1,
  documentationCompleteness: 0.05,
  deliveryPredictability: 0.15,
  conformance: 0.05,
  drift: 0.05,
} as const;

const TIME_TO_MARKET_DRIVER_ORDER = [
  'cross-domain-coordination-friction',
  'ownership-ambiguity',
  'change-impact-radius-pressure',
  'architectural-erosion-risk',
  'onboarding-friction',
  'delivery-predictability-pressure',
  'architecture-investment-priority',
] as const;

const TIME_TO_MARKET_COMPONENTS = [
  {
    key: 'crossDomainCoordination',
    weight: DEFAULT_TIME_TO_MARKET_RISK_WEIGHTS.crossDomainCoordination,
    ids: ['domain-integrity'],
    names: ['domain integrity'],
    families: ['boundaries'],
  },
  {
    key: 'ownershipCoverage',
    weight: DEFAULT_TIME_TO_MARKET_RISK_WEIGHTS.ownershipCoverage,
    ids: ['ownership-coverage'],
    names: ['ownership coverage'],
    families: ['ownership'],
  },
  {
    key: 'dependencyComplexity',
    weight: DEFAULT_TIME_TO_MARKET_RISK_WEIGHTS.dependencyComplexity,
    ids: ['dependency-complexity'],
    names: ['dependency complexity'],
    families: ['architecture'],
  },
  {
    key: 'layerIntegrity',
    weight: DEFAULT_TIME_TO_MARKET_RISK_WEIGHTS.layerIntegrity,
    ids: ['layer-integrity'],
    names: ['layer integrity'],
    families: ['boundaries'],
  },
  {
    key: 'documentationCompleteness',
    weight: DEFAULT_TIME_TO_MARKET_RISK_WEIGHTS.documentationCompleteness,
    ids: ['documentation-completeness'],
    names: ['documentation completeness'],
    families: ['documentation'],
  },
  {
    key: 'deliveryPredictability',
    weight: DEFAULT_TIME_TO_MARKET_RISK_WEIGHTS.deliveryPredictability,
    ids: [],
    names: [],
    families: [],
  },
  {
    key: 'conformance',
    weight: DEFAULT_TIME_TO_MARKET_RISK_WEIGHTS.conformance,
    ids: [],
    names: [],
    families: [],
  },
  {
    key: 'drift',
    weight: DEFAULT_TIME_TO_MARKET_RISK_WEIGHTS.drift,
    ids: [],
    names: [],
    families: [],
  },
] as const;

type TimeToMarketComponentKey =
  (typeof TIME_TO_MARKET_COMPONENTS)[number]['key'];

type MeasurementMatcher = {
  ids: readonly string[];
  names: readonly string[];
  families: readonly string[];
};

type IssueLike = {
  type: string;
  ruleId?: string;
  message: string;
};

interface WeightedSignal {
  delta: number;
  weight: number;
}

export function calculateTimeToMarketRiskIndex(
  input: CalculateTimeToMarketRiskIndexInput
): DeliveryImpactIndex {
  const { assessment, comparison } = input;
  const measurements = assessment.measurements;
  const drivers = resolveTimeToMarketDrivers(
    assessment,
    comparison,
    input.drivers
  );

  let weightedRiskTotal = 0;
  let appliedWeightTotal = 0;

  for (const component of TIME_TO_MARKET_COMPONENTS) {
    const risk = calculateComponentRisk(component.key, assessment, comparison);
    if (risk === undefined) {
      continue;
    }

    weightedRiskTotal += risk * component.weight;
    appliedWeightTotal += component.weight;
  }

  const score =
    appliedWeightTotal > 0
      ? roundToWholeNumber(weightedRiskTotal / appliedWeightTotal)
      : 0;

  return {
    id: 'time-to-market-risk',
    name: 'Time-to-Market Risk Index',
    score: clampScore(score),
    risk: deriveRiskBand(score),
    trend: deriveTimeToMarketTrend(assessment, comparison, measurements),
    drivers,
  };
}

function calculateComponentRisk(
  key: TimeToMarketComponentKey,
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined
): number | undefined {
  if (key === 'deliveryPredictability') {
    return invertHealthScore(assessment.health.score);
  }

  if (key === 'conformance') {
    return calculateConformanceRisk(assessment);
  }

  if (key === 'drift') {
    return calculateDriftRisk(comparison);
  }

  const component = TIME_TO_MARKET_COMPONENTS.find(
    (candidate) => candidate.key === key
  );

  if (!component) {
    return undefined;
  }

  const measurement = findMeasurement(assessment.measurements, component);
  if (!measurement) {
    return undefined;
  }

  return invertHealthScore(measurement.score);
}

function calculateConformanceRisk(assessment: GovernanceAssessment): number {
  const topIssueCount = assessment.topIssues
    .filter(isConformanceIssue)
    .reduce((sum, issue) => sum + issue.count, 0);
  const violationCount = assessment.violations.filter(isConformanceViolation)
    .length;

  return clampScore(topIssueCount * 20 + violationCount * 10);
}

function calculateDriftRisk(
  comparison: SnapshotComparison | undefined
): number | undefined {
  if (!comparison) {
    return undefined;
  }

  const worseningSignals: number[] = [];

  if (comparison.healthDelta) {
    worseningSignals.push(Math.max(0, -comparison.healthDelta.scoreDelta));
  }

  const relevantScoreIds = new Set<string>(
    TIME_TO_MARKET_COMPONENTS.flatMap((component) => component.ids)
  );

  for (const delta of comparison.scoreDeltas ?? []) {
    if (!relevantScoreIds.has(delta.id)) {
      continue;
    }

    worseningSignals.push(Math.max(0, -delta.delta));
  }

  const worseningTopIssueDelta = getTopIssueDeltaTotal(
    comparison,
    isTimeToMarketIssue
  );

  if (worseningTopIssueDelta !== undefined) {
    worseningSignals.push(Math.max(0, worseningTopIssueDelta * 10));
  }

  if (worseningSignals.length === 0) {
    return 0;
  }

  const average =
    worseningSignals.reduce((sum, value) => sum + value, 0) /
    worseningSignals.length;

  return clampScore(average);
}

function resolveTimeToMarketDrivers(
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined,
  providedDrivers: GovernanceInsightDriver[] | undefined
): GovernanceInsightDriver[] {
  const candidateDrivers =
    providedDrivers ??
    mapGovernanceDrivers({
      assessment,
      comparison,
    });

  const relevantDrivers = filterTimeToMarketDrivers(candidateDrivers);
  if (providedDrivers !== undefined || relevantDrivers.length > 0) {
    return relevantDrivers;
  }

  return deriveMeasurementDrivers(assessment);
}

function filterTimeToMarketDrivers(
  drivers: GovernanceInsightDriver[]
): GovernanceInsightDriver[] {
  const allowed = new Set(TIME_TO_MARKET_DRIVER_ORDER);

  return [...drivers]
    .filter((driver) =>
      allowed.has(driver.id as (typeof TIME_TO_MARKET_DRIVER_ORDER)[number])
    )
    .sort(
      (left, right) =>
        TIME_TO_MARKET_DRIVER_ORDER.indexOf(
          left.id as (typeof TIME_TO_MARKET_DRIVER_ORDER)[number]
        ) -
        TIME_TO_MARKET_DRIVER_ORDER.indexOf(
          right.id as (typeof TIME_TO_MARKET_DRIVER_ORDER)[number]
        )
    );
}

function deriveMeasurementDrivers(
  assessment: GovernanceAssessment
): GovernanceInsightDriver[] {
  const measurements = assessment.measurements;
  const derived: GovernanceInsightDriver[] = [];

  const driverConfigs = [
    {
      id: 'cross-domain-coordination-friction',
      label: 'Cross-domain coordination friction',
      matcher: TIME_TO_MARKET_COMPONENTS[0],
    },
    {
      id: 'ownership-ambiguity',
      label: 'Ownership ambiguity',
      matcher: TIME_TO_MARKET_COMPONENTS[1],
    },
    {
      id: 'change-impact-radius-pressure',
      label: 'Impact radius / blast radius pressure',
      matcher: TIME_TO_MARKET_COMPONENTS[2],
    },
    {
      id: 'architectural-erosion-risk',
      label: 'Architectural erosion / change safety risk',
      matcher: TIME_TO_MARKET_COMPONENTS[3],
    },
    {
      id: 'onboarding-friction',
      label: 'Knowledge transfer / onboarding friction',
      matcher: TIME_TO_MARKET_COMPONENTS[4],
    },
  ] as const;

  for (const config of driverConfigs) {
    const measurement = findMeasurement(measurements, config.matcher);
    if (!measurement) {
      continue;
    }

    derived.push({
      id: config.id,
      label: config.label,
      value: measurement.value,
      score: measurement.score,
      unit: measurement.unit,
      explanation: `${measurement.name} score is ${measurement.score}.`,
    });
  }

  if (
    assessment.health.status !== 'good' ||
    assessment.health.score < 100
  ) {
    derived.push({
      id: 'delivery-predictability-pressure',
      label: 'Delivery predictability pressure',
      value: assessment.health.score,
      score: assessment.health.score,
      unit: 'score',
      explanation: `Health score is ${assessment.health.score} with ${assessment.health.status} status.`,
    });
  }

  if (assessment.topIssues.length > 0) {
    derived.push({
      id: 'architecture-investment-priority',
      label: 'Prioritized architecture investment drivers',
      value: assessment.topIssues.reduce((sum, issue) => sum + issue.count, 0),
      unit: 'count',
      explanation: `Top issues are led by ${assessment.topIssues
        .slice(0, 2)
        .map((issue) => `${issue.message} (x${issue.count})`)
        .join('; ')}.`,
    });
  }

  return filterTimeToMarketDrivers(derived);
}

function deriveTimeToMarketTrend(
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined,
  measurements: Measurement[]
): DeliveryImpactIndex['trend'] {
  if (!comparison) {
    return 'stable';
  }

  const weightedSignals: WeightedSignal[] = [];

  const deliveryPredictabilityWeight =
    DEFAULT_TIME_TO_MARKET_RISK_WEIGHTS.deliveryPredictability;

  if (comparison.healthDelta) {
    weightedSignals.push({
      delta: comparison.healthDelta.scoreDelta,
      weight: deliveryPredictabilityWeight,
    });
  }

  for (const component of TIME_TO_MARKET_COMPONENTS) {
    if (
      component.key === 'deliveryPredictability' ||
      component.key === 'conformance' ||
      component.key === 'drift'
    ) {
      continue;
    }

    const measurement = findMeasurement(measurements, component);
    if (!measurement) {
      continue;
    }

    const delta = findScoreDelta(comparison.scoreDeltas, component.ids);
    if (delta === undefined) {
      continue;
    }

    weightedSignals.push({
      delta,
      weight: component.weight,
    });
  }

  const conformanceDelta = getTopIssueDeltaTotal(comparison, isConformanceIssue);
  if (conformanceDelta !== undefined) {
    weightedSignals.push({
      delta: -conformanceDelta * 10,
      weight: DEFAULT_TIME_TO_MARKET_RISK_WEIGHTS.conformance,
    });
  }

  const ttmIssueDelta = getTopIssueDeltaTotal(comparison, isTimeToMarketIssue);
  if (ttmIssueDelta !== undefined) {
    weightedSignals.push({
      delta: -ttmIssueDelta * 10,
      weight: DEFAULT_TIME_TO_MARKET_RISK_WEIGHTS.drift,
    });
  }

  if (weightedSignals.length === 0) {
    return 'stable';
  }

  const weightedAverage =
    weightedSignals.reduce(
      (sum, signal) => sum + signal.delta * signal.weight,
      0
    ) / weightedSignals.reduce((sum, signal) => sum + signal.weight, 0);

  if (weightedAverage < 0) {
    return 'worsening';
  }

  if (weightedAverage > 0) {
    return 'improving';
  }

  return 'stable';
}

function getTopIssueDeltaTotal(
  comparison: SnapshotComparison,
  predicate: (issue: IssueLike) => boolean
): number | undefined {
  const matching = comparison.topIssueDeltas?.filter(predicate) ?? [];

  if (matching.length === 0) {
    return undefined;
  }

  return matching.reduce((sum, delta) => sum + delta.delta, 0);
}

function isConformanceIssue(issue: IssueLike): boolean {
  return (
    issue.type === 'conformance-violation' ||
    matchesAnyText(getIssueText(issue), ['conformance', 'compliance'])
  );
}

function isTimeToMarketIssue(issue: IssueLike): boolean {
  return (
    issue.type === 'domain-boundary-violation' ||
    issue.type === 'cross-domain-dependency' ||
    issue.type === 'layer-boundary-violation' ||
    issue.type === 'ownership-gap' ||
    issue.type === 'structural-dependency' ||
    issue.type === 'conformance-violation' ||
    matchesAnyText(getIssueText(issue), [
      'cross-domain',
      'domain boundary',
      'layer boundary',
      'ownership',
      'dependency',
      'fanout',
      'conformance',
      'compliance',
    ])
  );
}

function isConformanceViolation(violation: Violation): boolean {
  return (
    violation.category === 'compliance' ||
    matchesAnyText(getViolationText(violation), ['conformance', 'compliance'])
  );
}

function findMeasurement(
  measurements: Measurement[],
  matcher: MeasurementMatcher
): Measurement | undefined {
  const exactIdMatch = measurements.find((measurement) =>
    matcher.ids.includes(measurement.id)
  );

  if (exactIdMatch) {
    return exactIdMatch;
  }

  const normalizedNames = matcher.names.map(normalizeText);
  const familyMatches = new Set(matcher.families);

  return measurements.find((measurement) => {
    const normalizedName = normalizeText(measurement.name);

    return (
      normalizedNames.includes(normalizedName) ||
      (familyMatches.has(measurement.family) &&
        normalizedNames.some((name) => normalizedName.includes(name)))
    );
  });
}

function findScoreDelta(
  deltas: SnapshotMetricDelta[] | undefined,
  ids: readonly string[]
): number | undefined {
  const delta = deltas?.find((entry) => ids.includes(entry.id));
  return delta?.delta;
}

function invertHealthScore(score: number): number {
  return 100 - clampScore(score);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function roundToWholeNumber(value: number): number {
  return Math.round(value);
}

function deriveRiskBand(score: number): DeliveryImpactIndex['risk'] {
  const normalized = clampScore(score);

  if (normalized >= 70) {
    return 'high';
  }

  if (normalized >= 40) {
    return 'medium';
  }

  return 'low';
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
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

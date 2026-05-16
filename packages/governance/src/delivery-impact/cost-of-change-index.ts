import type {
  GovernanceAssessment,
  Measurement,
  SnapshotComparison,
  SnapshotMetricDelta,
} from '../core/index.js';
import { mapGovernanceDrivers } from './map-governance-drivers.js';
import type {
  DeliveryImpactIndex,
  GovernanceInsightDriver,
} from './models.js';

export interface CalculateCostOfChangeIndexInput {
  assessment: GovernanceAssessment;
  comparison?: SnapshotComparison;
  drivers?: GovernanceInsightDriver[];
}

export const DEFAULT_COST_OF_CHANGE_WEIGHTS = {
  dependencyComplexity: 0.25,
  architecturalEntropy: 0.2,
  domainIntegrity: 0.2,
  layerIntegrity: 0.15,
  ownershipCoverage: 0.1,
  documentationCompleteness: 0.05,
  drift: 0.05,
} as const;

const COST_OF_CHANGE_DRIVER_ORDER = [
  'change-impact-radius-pressure',
  'cost-of-change-pressure',
  'architectural-erosion-risk',
  'cross-domain-coordination-friction',
  'ownership-ambiguity',
  'onboarding-friction',
] as const;

const COST_OF_CHANGE_COMPONENTS = [
  {
    key: 'dependencyComplexity',
    weight: DEFAULT_COST_OF_CHANGE_WEIGHTS.dependencyComplexity,
    ids: ['dependency-complexity'],
    names: ['dependency complexity'],
    families: ['architecture'],
  },
  {
    key: 'architecturalEntropy',
    weight: DEFAULT_COST_OF_CHANGE_WEIGHTS.architecturalEntropy,
    ids: ['architectural-entropy'],
    names: ['architectural entropy'],
    families: ['architecture'],
  },
  {
    key: 'domainIntegrity',
    weight: DEFAULT_COST_OF_CHANGE_WEIGHTS.domainIntegrity,
    ids: ['domain-integrity'],
    names: ['domain integrity'],
    families: ['boundaries'],
  },
  {
    key: 'layerIntegrity',
    weight: DEFAULT_COST_OF_CHANGE_WEIGHTS.layerIntegrity,
    ids: ['layer-integrity'],
    names: ['layer integrity'],
    families: ['boundaries'],
  },
  {
    key: 'ownershipCoverage',
    weight: DEFAULT_COST_OF_CHANGE_WEIGHTS.ownershipCoverage,
    ids: ['ownership-coverage'],
    names: ['ownership coverage'],
    families: ['ownership'],
  },
  {
    key: 'documentationCompleteness',
    weight: DEFAULT_COST_OF_CHANGE_WEIGHTS.documentationCompleteness,
    ids: ['documentation-completeness'],
    names: ['documentation completeness'],
    families: ['documentation'],
  },
  {
    key: 'drift',
    weight: DEFAULT_COST_OF_CHANGE_WEIGHTS.drift,
    ids: [],
    names: [],
    families: [],
  },
] as const;

type CostOfChangeComponentKey =
  (typeof COST_OF_CHANGE_COMPONENTS)[number]['key'];

type MeasurementMatcher = {
  ids: readonly string[];
  names: readonly string[];
  families: readonly string[];
};

interface WeightedDelta {
  delta: number;
  weight: number;
}

export function calculateCostOfChangeIndex(
  input: CalculateCostOfChangeIndexInput
): DeliveryImpactIndex {
  const { assessment, comparison } = input;
  const measurements = assessment.measurements;
  const providedDrivers = input.drivers;
  const drivers = resolveCostOfChangeDrivers(
    assessment,
    comparison,
    providedDrivers
  );

  let weightedRiskTotal = 0;
  let appliedWeightTotal = 0;

  for (const component of COST_OF_CHANGE_COMPONENTS) {
    const risk = calculateComponentRisk(component.key, measurements, comparison);

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
    id: 'cost-of-change',
    name: 'Cost of Change Index',
    score: clampScore(score),
    risk: deriveRiskBand(score),
    trend: deriveCostOfChangeTrend(comparison, measurements),
    drivers,
  };
}

function calculateComponentRisk(
  key: CostOfChangeComponentKey,
  measurements: Measurement[],
  comparison: SnapshotComparison | undefined
): number | undefined {
  if (key === 'drift') {
    return calculateDriftRisk(comparison);
  }

  const component = COST_OF_CHANGE_COMPONENTS.find(
    (candidate) => candidate.key === key
  );

  if (!component) {
    return undefined;
  }

  const measurement = findMeasurement(measurements, component);
  if (!measurement) {
    return undefined;
  }

  return invertHealthScore(measurement.score);
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
    COST_OF_CHANGE_COMPONENTS.flatMap((component) => component.ids)
  );

  for (const delta of comparison.scoreDeltas ?? []) {
    if (!relevantScoreIds.has(delta.id)) {
      continue;
    }

    worseningSignals.push(Math.max(0, -delta.delta));
  }

  if (worseningSignals.length === 0) {
    return 0;
  }

  const average =
    worseningSignals.reduce((sum, value) => sum + value, 0) /
    worseningSignals.length;

  return clampScore(average);
}

function resolveCostOfChangeDrivers(
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

  const relevantDrivers = filterCostOfChangeDrivers(candidateDrivers);
  if (providedDrivers !== undefined || relevantDrivers.length > 0) {
    return relevantDrivers;
  }

  return deriveMeasurementDrivers(assessment.measurements);
}

function filterCostOfChangeDrivers(
  drivers: GovernanceInsightDriver[]
): GovernanceInsightDriver[] {
  const allowed = new Set(COST_OF_CHANGE_DRIVER_ORDER);

  return [...drivers]
    .filter((driver) => allowed.has(driver.id as (typeof COST_OF_CHANGE_DRIVER_ORDER)[number]))
    .sort(
      (left, right) =>
        COST_OF_CHANGE_DRIVER_ORDER.indexOf(
          left.id as (typeof COST_OF_CHANGE_DRIVER_ORDER)[number]
        ) -
        COST_OF_CHANGE_DRIVER_ORDER.indexOf(
          right.id as (typeof COST_OF_CHANGE_DRIVER_ORDER)[number]
        )
    );
}

function deriveMeasurementDrivers(
  measurements: Measurement[]
): GovernanceInsightDriver[] {
  const derived: GovernanceInsightDriver[] = [];

  const driverConfigs = [
    {
      id: 'change-impact-radius-pressure',
      label: 'Impact radius / blast radius pressure',
      matcher: COST_OF_CHANGE_COMPONENTS[0],
    },
    {
      id: 'cost-of-change-pressure',
      label: 'Cost-of-change pressure',
      matcher: COST_OF_CHANGE_COMPONENTS[1],
    },
    {
      id: 'cross-domain-coordination-friction',
      label: 'Cross-domain coordination friction',
      matcher: COST_OF_CHANGE_COMPONENTS[2],
    },
    {
      id: 'architectural-erosion-risk',
      label: 'Architectural erosion / change safety risk',
      matcher: COST_OF_CHANGE_COMPONENTS[3],
    },
    {
      id: 'ownership-ambiguity',
      label: 'Ownership ambiguity',
      matcher: COST_OF_CHANGE_COMPONENTS[4],
    },
    {
      id: 'onboarding-friction',
      label: 'Knowledge transfer / onboarding friction',
      matcher: COST_OF_CHANGE_COMPONENTS[5],
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

  return filterCostOfChangeDrivers(derived);
}

function deriveCostOfChangeTrend(
  comparison: SnapshotComparison | undefined,
  measurements: Measurement[]
): DeliveryImpactIndex['trend'] {
  if (!comparison) {
    return 'stable';
  }

  const weightedDeltas: WeightedDelta[] = [];

  for (const component of COST_OF_CHANGE_COMPONENTS) {
    if (component.key === 'drift') {
      if (comparison.healthDelta) {
        weightedDeltas.push({
          delta: comparison.healthDelta.scoreDelta,
          weight: component.weight,
        });
      }
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

    weightedDeltas.push({
      delta,
      weight: component.weight,
    });
  }

  if (weightedDeltas.length === 0) {
    return 'stable';
  }

  const weightedAverage =
    weightedDeltas.reduce((sum, entry) => sum + entry.delta * entry.weight, 0) /
    weightedDeltas.reduce((sum, entry) => sum + entry.weight, 0);

  if (weightedAverage < 0) {
    return 'worsening';
  }

  if (weightedAverage > 0) {
    return 'improving';
  }

  return 'stable';
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

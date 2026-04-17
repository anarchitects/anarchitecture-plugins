import type {
  GovernanceMetricFamily,
  Measurement,
  MetricBreakdown,
} from '../core/index.js';

const FAMILY_ORDER: GovernanceMetricFamily[] = [
  'architecture',
  'boundaries',
  'ownership',
  'documentation',
];

export function buildMetricBreakdown(
  measurements: Measurement[]
): MetricBreakdown {
  const measurementsByFamily = new Map<GovernanceMetricFamily, Measurement[]>();

  for (const measurement of measurements) {
    const existing = measurementsByFamily.get(measurement.family) ?? [];
    existing.push(measurement);
    measurementsByFamily.set(measurement.family, existing);
  }

  const orderedFamilies = sortKnownThenAlphabetical(
    [...measurementsByFamily.keys()],
    FAMILY_ORDER
  );

  return {
    families: orderedFamilies.flatMap((family) => {
      const familyMeasurements = (measurementsByFamily.get(family) ?? [])
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((measurement) => ({
          id: measurement.id,
          name: measurement.name,
          score: measurement.score,
        }));

      if (familyMeasurements.length === 0) {
        return [];
      }

      const averageScore =
        familyMeasurements.reduce(
          (sum, measurement) => sum + measurement.score,
          0
        ) / familyMeasurements.length;

      return [
        {
          family,
          score: Math.round(averageScore),
          measurements: familyMeasurements,
        },
      ];
    }),
  };
}

function sortKnownThenAlphabetical<T extends string>(
  values: T[],
  knownOrder: readonly T[]
): T[] {
  const seen = new Set(values);
  const orderedKnown = knownOrder.filter((value) => seen.has(value));
  const orderedExtras = values
    .filter((value) => !knownOrder.includes(value))
    .sort((a, b) => a.localeCompare(b));

  return [...orderedKnown, ...orderedExtras];
}

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

const FAMILY_MEASUREMENT_IDS: Record<
  GovernanceMetricFamily,
  Measurement['id'][]
> = {
  architecture: [
    'architectural-entropy',
    'dependency-complexity',
    'domain-integrity',
    'layer-integrity',
  ],
  boundaries: ['architectural-entropy', 'domain-integrity', 'layer-integrity'],
  ownership: ['ownership-coverage'],
  documentation: ['documentation-completeness'],
};

export function buildMetricBreakdown(
  measurements: Measurement[]
): MetricBreakdown {
  const measurementsById = new Map(
    measurements.map((measurement) => [measurement.id, measurement] as const)
  );

  return {
    families: FAMILY_ORDER.flatMap((family) => {
      const familyMeasurements = FAMILY_MEASUREMENT_IDS[family]
        .map((id) => measurementsById.get(id))
        .filter((measurement): measurement is Measurement => !!measurement)
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

import {
  DEFAULT_HEALTH_STATUS_THRESHOLDS,
  HealthScore,
  HealthStatus,
  HealthStatusThresholds,
  Measurement,
  Recommendation,
  Violation,
} from '../core/index.js';

export type MetricWeights = Partial<Record<Measurement['id'], number>>;

export function calculateHealthScore(
  measurements: Measurement[],
  metricWeights: MetricWeights = {},
  statusThresholds: Partial<HealthStatusThresholds> = DEFAULT_HEALTH_STATUS_THRESHOLDS
): HealthScore {
  const score = Math.round(weightedAverage(measurements, metricWeights));
  const resolvedStatusThresholds = resolveStatusThresholds(statusThresholds);

  return {
    score,
    status: statusForScore(score, resolvedStatusThresholds),
    grade: gradeForScore(score),
    hotspots: measurements
      .filter((measurement) => measurement.score < 60)
      .map((measurement) => measurement.name),
  };
}

function weightedAverage(
  measurements: Measurement[],
  metricWeights: MetricWeights
): number {
  if (measurements.length === 0) {
    return 0;
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const measurement of measurements) {
    const configuredWeight = metricWeights[measurement.id] ?? 1;
    const safeWeight = configuredWeight > 0 ? configuredWeight : 0;

    weightedSum += measurement.score * safeWeight;
    totalWeight += safeWeight;
  }

  if (totalWeight === 0) {
    return (
      measurements.reduce((sum, measurement) => sum + measurement.score, 0) /
      measurements.length
    );
  }

  return weightedSum / totalWeight;
}

export function buildRecommendations(
  violations: Violation[],
  measurements: Measurement[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (violations.some((violation) => violation.ruleId === 'domain-boundary')) {
    recommendations.push({
      id: 'reduce-cross-domain-dependencies',
      title: 'Reduce cross-domain dependencies',
      priority: 'high',
      reason:
        'Domain boundary violations indicate tight coupling across business domains.',
    });
  }

  if (
    violations.some((violation) => violation.ruleId === 'ownership-presence')
  ) {
    recommendations.push({
      id: 'improve-ownership-coverage',
      title: 'Improve ownership coverage',
      priority: 'medium',
      reason:
        'Unowned projects slow down incident response and architectural decision making.',
    });
  }

  if (
    (measurements.find(
      (measurement) => measurement.id === 'dependency-complexity'
    )?.score ?? 100) < 60
  ) {
    recommendations.push({
      id: 'reduce-dependency-complexity',
      title: 'Reduce dependency complexity',
      priority: 'medium',
      reason:
        'High dependency complexity increases blast radius and maintenance cost.',
    });
  }

  return recommendations;
}

function gradeForScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function statusForScore(
  score: number,
  thresholds: HealthStatusThresholds
): HealthStatus {
  if (score >= thresholds.goodMinScore) {
    return 'good';
  }

  if (score >= thresholds.warningMinScore) {
    return 'warning';
  }

  return 'critical';
}

function resolveStatusThresholds(
  thresholds: Partial<HealthStatusThresholds>
): HealthStatusThresholds {
  const goodMinScore =
    typeof thresholds.goodMinScore === 'number' &&
    Number.isFinite(thresholds.goodMinScore)
      ? thresholds.goodMinScore
      : DEFAULT_HEALTH_STATUS_THRESHOLDS.goodMinScore;
  const warningMinScore =
    typeof thresholds.warningMinScore === 'number' &&
    Number.isFinite(thresholds.warningMinScore)
      ? thresholds.warningMinScore
      : DEFAULT_HEALTH_STATUS_THRESHOLDS.warningMinScore;

  if (goodMinScore <= warningMinScore) {
    return DEFAULT_HEALTH_STATUS_THRESHOLDS;
  }

  return {
    goodMinScore,
    warningMinScore,
  };
}

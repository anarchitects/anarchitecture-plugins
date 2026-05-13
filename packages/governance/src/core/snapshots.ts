import type {
  GovernanceAssessment,
  MetricSnapshot,
  SnapshotViolation,
} from './models.js';

export interface GovernanceSnapshotMetadata {
  timestamp: string;
  repo: string;
  branch: string;
  commitSha: string;
  pluginVersion: string;
  metricSchemaVersion: string;
}

export function buildMetricSnapshot(
  assessment: GovernanceAssessment,
  metadata: GovernanceSnapshotMetadata
): MetricSnapshot {
  const metrics = Object.fromEntries(
    assessment.measurements.map((measurement) => [
      measurement.id,
      measurement.value,
    ])
  );
  const scores = {
    workspaceHealth: assessment.health.score,
    ...Object.fromEntries(
      assessment.measurements.map((measurement) => [
        measurement.id,
        measurement.score,
      ])
    ),
  };

  const violations: SnapshotViolation[] = assessment.violations.map(
    (violation) => ({
      type: violation.ruleId,
      source: violation.project,
      target: asString(violation.details?.target),
      ruleId: violation.ruleId,
      severity: violation.severity,
      message: violation.message,
    })
  );

  return {
    ...metadata,
    metrics,
    scores,
    violations,
    health: {
      score: assessment.health.score,
      status: assessment.health.status,
      grade: assessment.health.grade,
    },
    signalBreakdown: assessment.signalBreakdown,
    metricBreakdown: assessment.metricBreakdown,
    topIssues: assessment.topIssues,
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

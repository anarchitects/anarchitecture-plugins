import { GovernanceAssessment } from '../core/index.js';

export function renderCliReport(assessment: GovernanceAssessment): string {
  const lines: string[] = [];

  lines.push(`Nx Governance - ${assessment.profile}`);
  lines.push('');
  lines.push(
    `Health Score: ${assessment.health.score} (${assessment.health.grade})`
  );
  lines.push(`Projects: ${assessment.workspace.projects.length}`);
  lines.push(`Dependencies: ${assessment.workspace.dependencies.length}`);
  lines.push(`Violations: ${assessment.violations.length}`);

  lines.push('');
  lines.push('Signal Sources:');
  for (const entry of assessment.signalBreakdown.bySource) {
    lines.push(`- ${entry.source}: ${entry.count}`);
  }

  if (assessment.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of assessment.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('');
  lines.push('Metrics:');

  for (const metric of assessment.measurements) {
    lines.push(`- ${metric.name}: ${metric.score}/100`);
  }

  if (assessment.violations.length > 0) {
    lines.push('');
    lines.push('Top Violations:');
    for (const violation of assessment.violations.slice(0, 10)) {
      lines.push(
        `- [${violation.severity}] ${violation.ruleId} :: ${violation.message}`
      );
    }
  }

  if (assessment.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const recommendation of assessment.recommendations) {
      lines.push(
        `- (${recommendation.priority}) ${recommendation.title} - ${recommendation.reason}`
      );
    }
  }

  return lines.join('\n');
}

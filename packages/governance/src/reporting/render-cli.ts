import { GovernanceAssessment } from '../core/index.js';

const TOP_ISSUES_LIMIT = 10;

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

  lines.push('');
  lines.push('Signal Types:');
  for (const entry of assessment.signalBreakdown.byType) {
    lines.push(`- ${entry.type}: ${entry.count}`);
  }

  lines.push('');
  lines.push('Signal Severity:');
  for (const entry of assessment.signalBreakdown.bySeverity) {
    lines.push(`- ${entry.severity}: ${entry.count}`);
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

  if (assessment.metricBreakdown.families.length > 0) {
    lines.push('');
    lines.push('Metric Families:');
    for (const family of assessment.metricBreakdown.families) {
      lines.push(`- ${family.family}: ${family.score}/100`);
      lines.push(
        `  measurements: ${family.measurements
          .map((measurement) => `${measurement.name} (${measurement.score})`)
          .join(', ')}`
      );
    }
  }

  if (assessment.topIssues.length > 0) {
    lines.push('');
    lines.push('Top Issues:');
    for (const issue of assessment.topIssues.slice(0, TOP_ISSUES_LIMIT)) {
      const ruleIdSuffix = issue.ruleId ? ` :: ${issue.ruleId}` : '';
      const projectsSuffix =
        issue.projects.length > 0
          ? ` :: projects=${issue.projects.join(',')}`
          : '';
      lines.push(
        `- [${issue.severity}] ${issue.type} (${issue.source}) x${issue.count}${ruleIdSuffix}${projectsSuffix} :: ${issue.message}`
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

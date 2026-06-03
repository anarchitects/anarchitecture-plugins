import type {
  GovernanceAssessment,
  GovernanceDiagnostic,
} from '@anarchitects/governance-core';
import type { GovernanceExtensionDiagnostic } from '../extensions/diagnostics.js';

import {
  buildGovernanceRenderingModel,
  type GovernanceRendererInput,
} from './canonical-rendering-model.js';

const TOP_ISSUES_LIMIT = 10;
const DIAGNOSTIC_ATTENTION_PATTERN =
  /(error|warning|warn|failed|failure|invalid|missing|required|deprecated|unable)/i;

export function renderCliReport(input: GovernanceRendererInput): string {
  const model = buildGovernanceRenderingModel(input);
  const assessment = model.assessment;
  const lines: string[] = [];

  lines.push(`Nx Governance - ${assessment.profile}`);
  lines.push('');
  lines.push(
    `Health Score: ${assessment.health.score} (${formatHealthStatus(
      assessment.health.status
    )}, ${assessment.health.grade})`
  );
  lines.push(`Projects: ${assessment.workspace.projects.length}`);
  lines.push(`Dependencies: ${assessment.workspace.dependencies.length}`);
  if (model.hasCanonicalGraph) {
    lines.push(
      `Canonical Graph: ${model.nodes.length} nodes, ${model.relations.length} relations`
    );
  }
  lines.push(`Violations: ${assessment.violations.length}`);

  const attentionDiagnostics = selectAttentionDiagnostics(
    model.diagnostics,
    model.extensionDiagnostics
  );
  if (attentionDiagnostics.length > 0) {
    lines.push(
      `Diagnostics requiring attention: ${attentionDiagnostics.length}`
    );
  }

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

  if (attentionDiagnostics.length > 0) {
    lines.push('');
    lines.push('Diagnostics Requiring Attention:');
    for (const diagnostic of attentionDiagnostics) {
      lines.push(
        `- ${diagnostic.code}: ${diagnostic.message}${formatDiagnosticSource(
          diagnostic
        )}`
      );
    }
  }

  lines.push('');
  lines.push('Exceptions:');
  lines.push(`- declared: ${assessment.exceptions.summary.declaredCount}`);
  lines.push(`- matched: ${assessment.exceptions.summary.matchedCount}`);
  lines.push(`- unused: ${assessment.exceptions.summary.unusedExceptionCount}`);
  lines.push(`- active: ${assessment.exceptions.summary.activeExceptionCount}`);
  lines.push(`- stale: ${assessment.exceptions.summary.staleExceptionCount}`);
  lines.push(
    `- expired: ${assessment.exceptions.summary.expiredExceptionCount}`
  );
  lines.push(
    `- suppressed policy findings: ${assessment.exceptions.summary.suppressedPolicyViolationCount}`
  );
  lines.push(
    `- suppressed conformance findings: ${assessment.exceptions.summary.suppressedConformanceFindingCount}`
  );
  lines.push(
    `- reactivated policy findings: ${assessment.exceptions.summary.reactivatedPolicyViolationCount}`
  );
  lines.push(
    `- reactivated conformance findings: ${assessment.exceptions.summary.reactivatedConformanceFindingCount}`
  );

  if (assessment.exceptions.suppressedFindings.length > 0) {
    lines.push('Suppressed Findings:');
    for (const finding of assessment.exceptions.suppressedFindings) {
      const ruleIdSuffix = finding.ruleId ? ` :: ${finding.ruleId}` : '';
      const projectScope = [
        finding.projectId,
        finding.targetProjectId,
        finding.relatedProjectIds.length > 0
          ? `related=${finding.relatedProjectIds.join(',')}`
          : undefined,
      ]
        .filter((value): value is string => !!value)
        .join(' -> ');
      const projectScopeSuffix = projectScope
        ? ` :: scope=${projectScope}`
        : '';

      lines.push(
        `- ${finding.exceptionId} :: ${finding.status} :: ${finding.source}/${finding.kind} :: [${finding.severity}]${ruleIdSuffix}${projectScopeSuffix} :: ${finding.message}`
      );
    }
  }

  if (assessment.exceptions.reactivatedFindings.length > 0) {
    lines.push('Reactivated Findings:');
    for (const finding of assessment.exceptions.reactivatedFindings) {
      const ruleIdSuffix = finding.ruleId ? ` :: ${finding.ruleId}` : '';
      const projectScope = [
        finding.projectId,
        finding.targetProjectId,
        finding.relatedProjectIds.length > 0
          ? `related=${finding.relatedProjectIds.join(',')}`
          : undefined,
      ]
        .filter((value): value is string => !!value)
        .join(' -> ');
      const projectScopeSuffix = projectScope
        ? ` :: scope=${projectScope}`
        : '';

      lines.push(
        `- ${finding.exceptionId} :: ${finding.status} :: ${finding.source}/${finding.kind} :: [${finding.severity}]${ruleIdSuffix}${projectScopeSuffix} :: ${finding.message}`
      );
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

  if (assessment.health.metricHotspots.length > 0) {
    lines.push('');
    lines.push('Metric Hotspots:');
    for (const hotspot of assessment.health.metricHotspots) {
      lines.push(`- ${hotspot.name}: ${hotspot.score}/100`);
    }
  }

  if (assessment.health.projectHotspots.length > 0) {
    lines.push('');
    lines.push('Project Hotspots:');
    for (const hotspot of assessment.health.projectHotspots) {
      lines.push(
        `- ${hotspot.project}: ${
          hotspot.count
        } :: types=${hotspot.dominantIssueTypes.join(',')}`
      );
    }
  }

  lines.push('');
  lines.push('Explainability:');
  lines.push(`- summary: ${assessment.health.explainability.summary}`);
  lines.push(
    `- status reason: ${assessment.health.explainability.statusReason}`
  );
  if (assessment.health.explainability.weakestMetrics.length > 0) {
    lines.push(
      `- weakest metrics: ${assessment.health.explainability.weakestMetrics
        .map((metric) => `${metric.name} (${metric.score})`)
        .join(', ')}`
    );
  }
  if (assessment.health.explainability.dominantIssues.length > 0) {
    lines.push(
      `- dominant issues: ${assessment.health.explainability.dominantIssues
        .map((issue) => `${issue.type} x${issue.count}`)
        .join(', ')}`
    );
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

function formatHealthStatus(status: GovernanceAssessment['health']['status']) {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

type RenderedDiagnostic = GovernanceDiagnostic | GovernanceExtensionDiagnostic;

function selectAttentionDiagnostics(
  diagnostics: GovernanceDiagnostic[],
  extensionDiagnostics: GovernanceExtensionDiagnostic[]
): RenderedDiagnostic[] {
  return [
    ...diagnostics.filter(isGovernanceDiagnosticRequiringAttention),
    ...extensionDiagnostics.filter(
      (diagnostic) => diagnostic.severity !== 'notice'
    ),
  ];
}

function isGovernanceDiagnosticRequiringAttention(
  diagnostic: GovernanceDiagnostic
): boolean {
  return DIAGNOSTIC_ATTENTION_PATTERN.test(
    `${diagnostic.code} ${diagnostic.message}`
  );
}

function formatDiagnosticSource(diagnostic: RenderedDiagnostic): string {
  if ('severity' in diagnostic) {
    return ` (${diagnostic.severity})`;
  }

  return diagnostic.source ? ` (${diagnostic.source})` : '';
}

import type {
  GovernanceAssessment,
  GovernanceDiagnostic,
  GovernanceSignal,
} from '@anarchitects/governance-core';
import type { GovernanceExtensionDiagnostic } from '../extensions/diagnostics.js';

import {
  buildGovernanceRenderingModel,
  buildNodeLabelMap,
  buildRelationLabelMap,
  type GovernanceRendererInput,
  type RenderableCanonicalNode,
  type RenderableCanonicalRelation,
} from './canonical-rendering-model.js';

const TOP_ISSUES_LIMIT = 10;
const DIAGNOSTIC_ATTENTION_PATTERN =
  /(error|warning|warn|failed|failure|invalid|missing|required|deprecated|unable)/i;

type GovernanceEvidence = {
  id: string;
  type: string;
  [key: string]: unknown;
};

interface CanonicalReference {
  nodeId?: string;
  relationId?: string;
  relatedNodeIds?: string[];
  relatedRelationIds?: string[];
}

interface CanonicalReferenceCarrier {
  subjectId?: string;
  reference?: CanonicalReference;
  nodeId?: string;
  relationId?: string;
  relatedNodeIds?: string[];
  relatedRelationIds?: string[];
  metadata?: Record<string, unknown>;
}

interface CanonicalSubjectHotspot {
  subjectId: string;
  subjectType?: 'node' | 'relation' | 'subject' | (string & {});
  count: number;
  dominantIssueTypes: string[];
}

export function renderCliReport(input: GovernanceRendererInput): string {
  const model = buildGovernanceRenderingModel(input);
  const assessment = model.assessment;
  const lines: string[] = [];
  const nodeLabels = buildNodeLabelMap(model.nodes);
  const relationLabels = buildRelationLabelMap(model.relations, nodeLabels);
  const subjectHotspots = readSubjectHotspots(assessment);

  lines.push(`Nx Governance - ${assessment.profile}`);
  lines.push('');
  lines.push(
    `Health Score: ${assessment.health.score} (${formatHealthStatus(
      assessment.health.status
    )}, ${assessment.health.grade})`
  );
  lines.push(`Nodes: ${model.nodes.length}`);
  lines.push(`Relations: ${model.relations.length}`);
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

  if (model.nodes.length > 0) {
    lines.push('');
    lines.push('Nodes:');
    for (const node of model.nodes) {
      lines.push(`- ${formatRenderableNode(node)}`);
    }
  }

  if (model.relations.length > 0) {
    lines.push('');
    lines.push('Relations:');
    for (const relation of model.relations) {
      lines.push(`- ${formatRenderableRelation(relation, nodeLabels)}`);
    }
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

  if (model.signals.length > 0) {
    lines.push('');
    lines.push('Signals:');
    for (const signal of [...model.signals].sort(compareSignals)) {
      const scopeSuffix = formatScopeSuffix(
        signal as unknown as CanonicalReferenceCarrier,
        nodeLabels,
        relationLabels
      );
      lines.push(
        `- [${signal.severity}] ${signal.type} (${signal.source})${scopeSuffix} :: ${signal.message}`
      );
    }
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
      const scopeSuffix = formatScopeSuffix(
        finding as unknown as CanonicalReferenceCarrier,
        nodeLabels,
        relationLabels
      );

      lines.push(
        `- ${finding.exceptionId} :: ${finding.status} :: ${finding.source}/${finding.kind} :: [${finding.severity}]${ruleIdSuffix}${scopeSuffix} :: ${finding.message}`
      );
    }
  }

  if (assessment.exceptions.reactivatedFindings.length > 0) {
    lines.push('Reactivated Findings:');
    for (const finding of assessment.exceptions.reactivatedFindings) {
      const ruleIdSuffix = finding.ruleId ? ` :: ${finding.ruleId}` : '';
      const scopeSuffix = formatScopeSuffix(
        finding as unknown as CanonicalReferenceCarrier,
        nodeLabels,
        relationLabels
      );

      lines.push(
        `- ${finding.exceptionId} :: ${finding.status} :: ${finding.source}/${finding.kind} :: [${finding.severity}]${ruleIdSuffix}${scopeSuffix} :: ${finding.message}`
      );
    }
  }

  lines.push('');
  lines.push('Metrics:');

  for (const metric of assessment.measurements) {
    const scopeSuffix = formatScopeSuffix(
      metric as unknown as CanonicalReferenceCarrier,
      nodeLabels,
      relationLabels
    );
    lines.push(`- ${metric.name}: ${metric.score}/100${scopeSuffix}`);
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

  if (subjectHotspots.length > 0) {
    lines.push('');
    lines.push('Subject Hotspots:');
    for (const hotspot of subjectHotspots) {
      lines.push(
        `- ${resolveSubjectLabel(
          hotspot.subjectId,
          nodeLabels,
          relationLabels
        )}: ${hotspot.count} :: type=${
          hotspot.subjectType ?? 'subject'
        } :: issues=${hotspot.dominantIssueTypes.join(',')}`
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
      const scopeSuffix = formatScopeSuffix(
        issue as unknown as CanonicalReferenceCarrier,
        nodeLabels,
        relationLabels
      );
      lines.push(
        `- [${issue.severity}] ${issue.type} (${issue.source}) x${issue.count}${ruleIdSuffix}${scopeSuffix} :: ${issue.message}`
      );
    }
  }

  if (assessment.violations.length > 0) {
    lines.push('');
    lines.push('Violation Details:');
    for (const violation of assessment.violations) {
      const ruleIdSuffix = violation.ruleId ? ` :: ${violation.ruleId}` : '';
      const scopeSuffix = formatScopeSuffix(
        violation as unknown as CanonicalReferenceCarrier,
        nodeLabels,
        relationLabels
      );
      lines.push(
        `- [${violation.severity}] ${violation.category}${ruleIdSuffix}${scopeSuffix} :: ${violation.message}`
      );
    }
  }

  if (assessment.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const recommendation of assessment.recommendations) {
      const scopeSuffix = formatScopeSuffix(
        recommendation as unknown as CanonicalReferenceCarrier,
        nodeLabels,
        relationLabels
      );
      lines.push(
        `- (${recommendation.priority}) ${recommendation.title}${scopeSuffix} - ${recommendation.reason}`
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

function formatRenderableNode(node: RenderableCanonicalNode): string {
  const segments = [
    `${node.name ?? node.id} [${node.id}]`,
    ...(node.kind ? [`kind=${node.kind}`] : []),
    ...(node.sourceSystem ? [`source=${node.sourceSystem}`] : []),
    ...(node.technology ? [`tech=${node.technology}`] : []),
    ...(node.classification
      ? [`class=${formatClassification(node.classification)}`]
      : []),
    ...(node.ownership?.team ? [`owner=${node.ownership.team}`] : []),
    ...(node.tags && node.tags.length > 0
      ? [`tags=${node.tags.join(',')}`]
      : []),
    ...(node.path
      ? [`path=${node.path}`]
      : node.root
      ? [`root=${node.root}`]
      : []),
    ...(node.metadata ? [`metadata=${formatMetadata(node.metadata)}`] : []),
  ];

  return segments.join(' :: ');
}

function formatRenderableRelation(
  relation: RenderableCanonicalRelation,
  nodeLabels: ReadonlyMap<string, string>
): string {
  const sourceLabel =
    nodeLabels.get(relation.sourceNodeId) ?? relation.sourceNodeId;
  const targetLabel =
    nodeLabels.get(relation.targetNodeId) ?? relation.targetNodeId;
  const segments = [
    relation.id,
    `${sourceLabel} -> ${targetLabel}`,
    ...(relation.kind ? [`kind=${relation.kind}`] : []),
    ...(relation.metadata
      ? [`metadata=${formatMetadata(relation.metadata)}`]
      : []),
    ...(relation.evidence && relation.evidence.length > 0
      ? [`evidence=${formatEvidence(relation.evidence)}`]
      : []),
  ];

  return segments.join(' :: ');
}

function formatClassification(
  classification: NonNullable<RenderableCanonicalNode['classification']>
): string {
  return [
    ...(classification.domain ? [`domain=${classification.domain}`] : []),
    ...(classification.layer ? [`layer=${classification.layer}`] : []),
    ...(classification.scope ? [`scope=${classification.scope}`] : []),
  ].join(',');
}

function formatMetadata(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${formatUnknown(value)}`)
    .join(',');
}

function formatEvidence(evidence: GovernanceEvidence[]): string {
  return [...evidence]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((entry) => entry.type)
    .join(',');
}

function formatUnknown(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(formatUnknown).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${key}:${formatUnknown(entry)}`)
      .join(',')}}`;
  }

  return String(value);
}

function formatNodeReference(
  nodeId: string,
  nodeLabels: ReadonlyMap<string, string>
): string {
  return `node=${resolveSubjectLabel(nodeId, nodeLabels)}`;
}

function formatRelationReference(
  relationId: string,
  relationLabels: ReadonlyMap<string, string>
): string {
  return `relation=${resolveSubjectLabel(
    undefined,
    undefined,
    relationLabels,
    relationId
  )}`;
}

function formatScopeSuffix(
  carrier: CanonicalReferenceCarrier,
  nodeLabels: ReadonlyMap<string, string>,
  relationLabels: ReadonlyMap<string, string>
): string {
  const reference = readReference(carrier);
  const segments = [
    ...(reference.nodeId
      ? [formatNodeReference(reference.nodeId, nodeLabels)]
      : []),
    ...(reference.relationId
      ? [formatRelationReference(reference.relationId, relationLabels)]
      : []),
    ...(reference.relatedNodeIds && reference.relatedNodeIds.length > 0
      ? [
          `related nodes=${reference.relatedNodeIds
            .map((nodeId) => resolveSubjectLabel(nodeId, nodeLabels))
            .join(',')}`,
        ]
      : []),
    ...(reference.relatedRelationIds && reference.relatedRelationIds.length > 0
      ? [
          `related relations=${reference.relatedRelationIds
            .map((relationId) =>
              resolveSubjectLabel(
                undefined,
                undefined,
                relationLabels,
                relationId
              )
            )
            .join(',')}`,
        ]
      : []),
    ...(carrier.subjectId &&
    !reference.nodeId &&
    !reference.relationId &&
    !reference.relatedNodeIds?.length &&
    !reference.relatedRelationIds?.length
      ? [
          `subject=${resolveSubjectLabel(
            carrier.subjectId,
            nodeLabels,
            relationLabels
          )}`,
        ]
      : []),
  ];

  return segments.length > 0 ? ` :: scope=${segments.join(' ; ')}` : '';
}

function readReference(carrier: CanonicalReferenceCarrier): CanonicalReference {
  const directReference = asRecord(carrier.reference);
  const metadataReference = asRecord(asRecord(carrier.metadata)?.reference);
  const nodeId = asString(directReference?.nodeId) ?? asString(carrier.nodeId);
  const relationId =
    asString(directReference?.relationId) ?? asString(carrier.relationId);
  const relatedNodeIds = uniqueSorted([
    ...stringArray(directReference?.relatedNodeIds),
    ...stringArray(metadataReference?.relatedNodeIds),
    ...stringArray(carrier.relatedNodeIds),
  ]);
  const relatedRelationIds = uniqueSorted([
    ...stringArray(directReference?.relatedRelationIds),
    ...stringArray(metadataReference?.relatedRelationIds),
    ...stringArray(carrier.relatedRelationIds),
  ]);

  return {
    ...(nodeId ? { nodeId } : {}),
    ...(relationId ? { relationId } : {}),
    ...(relatedNodeIds.length > 0 ? { relatedNodeIds } : {}),
    ...(relatedRelationIds.length > 0 ? { relatedRelationIds } : {}),
  };
}

function readSubjectHotspots(
  assessment: GovernanceAssessment
): CanonicalSubjectHotspot[] {
  const hotspots = (assessment.health as unknown as { hotspots?: unknown[] })
    .hotspots;

  if (!Array.isArray(hotspots)) {
    return [];
  }

  return hotspots
    .map((entry) => asRecord(entry))
    .filter(
      (
        entry
      ): entry is Record<string, unknown> & {
        subjectId: string;
        count: number;
      } =>
        Boolean(asString(entry?.subjectId)) && typeof entry?.count === 'number'
    )
    .map((entry) => ({
      subjectId: asString(entry.subjectId) ?? 'unknown',
      ...(asString(entry.subjectType)
        ? { subjectType: asString(entry.subjectType) }
        : {}),
      count: entry.count as number,
      dominantIssueTypes: uniqueSorted(stringArray(entry.dominantIssueTypes)),
    }))
    .sort(
      (left, right) =>
        left.subjectId.localeCompare(right.subjectId) ||
        left.count - right.count
    );
}

function resolveSubjectLabel(
  subjectId: string | undefined,
  nodeLabels?: ReadonlyMap<string, string>,
  relationLabels?: ReadonlyMap<string, string>,
  explicitRelationId?: string
): string {
  const relationLabel =
    (subjectId ? relationLabels?.get(subjectId) : undefined) ??
    (explicitRelationId ? relationLabels?.get(explicitRelationId) : undefined);
  if (relationLabel) {
    return relationLabel;
  }

  const nodeLabel = subjectId ? nodeLabels?.get(subjectId) : undefined;
  if (nodeLabel) {
    return nodeLabel;
  }

  return explicitRelationId ?? subjectId ?? 'unknown';
}

function compareSignals(
  left: GovernanceSignal,
  right: GovernanceSignal
): number {
  return (
    left.id.localeCompare(right.id) ||
    left.type.localeCompare(right.type) ||
    left.severity.localeCompare(right.severity)
  );
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

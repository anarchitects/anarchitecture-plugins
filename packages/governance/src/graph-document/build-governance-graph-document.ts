import type {
  GovernanceAssessment,
  GovernanceDependency,
  GovernanceProject,
  Violation,
} from '../core/index.js';
import type { GovernanceSignal } from '../signal-engine/index.js';
import type { GovernanceSignalSeverity } from '../signal-engine/types.js';
import {
  GOVERNANCE_GRAPH_DOCUMENT_SCHEMA_VERSION,
  type GovernanceGraphDocument,
  type GovernanceGraphEdge,
  type GovernanceGraphFacets,
  type GovernanceGraphFinding,
  type GovernanceGraphFindingSource,
  type GovernanceGraphHealth,
  type GovernanceGraphNode,
  type GovernanceGraphSummary,
} from './contracts.js';

export interface GovernanceGraphBuilderInput {
  assessment: GovernanceAssessment;
  signals?: GovernanceSignal[];
  generatedAt?: string;
  schemaVersion?: string;
}

interface DraftGraphFinding extends GovernanceGraphFinding {
  relatedProjectIds: string[];
}

interface DraftGraphNode {
  node: Omit<GovernanceGraphNode, 'health' | 'findings'>;
  findings: DraftGraphFinding[];
}

interface DraftGraphEdge {
  edge: Omit<GovernanceGraphEdge, 'health' | 'findings'>;
  findings: DraftGraphFinding[];
}

const FINDING_SOURCE_ORDER: Record<GovernanceGraphFindingSource, number> = {
  policy: 0,
  conformance: 1,
  signal: 2,
  extension: 3,
  metric: 4,
};

const FINDING_SEVERITY_ORDER: Record<GovernanceSignalSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const HEALTH_ORDER: Record<GovernanceGraphHealth, number> = {
  critical: 0,
  warning: 1,
  healthy: 2,
  unknown: 3,
};

/**
 * Builds a stable, JSON-serializable graph document from governance artifacts.
 */
export function buildGovernanceGraphDocument(
  input: GovernanceGraphBuilderInput
): GovernanceGraphDocument {
  const workspace = input.assessment.workspace;
  const nodes = [...workspace.projects].sort(compareProjects);
  const edges = [...workspace.dependencies].sort(compareDependencies);

  const nodeDrafts = new Map<string, DraftGraphNode>(
    nodes.map((project) => {
      const owner = readOwner(project);
      const metadata = serializeProjectMetadata(project.metadata);

      return [
        project.id,
        {
          node: {
            id: project.id,
            label: project.name,
            type: project.type,
            tags: uniqueSorted(project.tags),
            ...(owner ? { owner } : {}),
            ...(metadata ? { metadata } : {}),
          },
          findings: [],
        },
      ];
    })
  );

  const edgeDrafts = new Map<string, DraftGraphEdge>(
    edges.map((dependency) => {
      const edgeId = buildEdgeId(dependency);
      return [
        edgeId,
        {
          edge: {
            id: edgeId,
            source: dependency.source,
            target: dependency.target,
            type: dependency.type,
          },
          findings: [],
        },
      ];
    })
  );

  const edgesByPair = new Map<string, DraftGraphEdge[]>();
  for (const draft of edgeDrafts.values()) {
    const pairKey = buildEdgePairKey(draft.edge.source, draft.edge.target);
    const existing = edgesByPair.get(pairKey) ?? [];
    existing.push(draft);
    edgesByPair.set(pairKey, existing);
  }

  const findings = buildFindings(input);
  for (const finding of findings) {
    const edge = resolveEdgeForFinding(finding, edgesByPair);
    if (edge) {
      edge.findings.push(finding);
      continue;
    }

    const node = resolveNodeForFinding(finding, nodeDrafts);
    if (node) {
      node.findings.push(finding);
    }
  }

  const finalizedNodes = [...nodeDrafts.values()]
    .map(({ node, findings }) => ({
      ...node,
      findings: [...findings].sort(compareFindings).map(stripRelatedProjects),
      health: deriveHealth(findings, true),
    }))
    .sort(compareGraphNodes);

  const finalizedEdges = [...edgeDrafts.values()]
    .map(({ edge, findings }) => ({
      ...edge,
      findings: [...findings].sort(compareFindings).map(stripRelatedProjects),
      health: deriveHealth(findings, true),
    }))
    .sort(compareGraphEdges);

  return {
    schemaVersion:
      input.schemaVersion ?? GOVERNANCE_GRAPH_DOCUMENT_SCHEMA_VERSION,
    ...(input.generatedAt ? { generatedAt: input.generatedAt } : {}),
    workspace: {
      ...(workspace.id ? { id: workspace.id } : {}),
      ...(workspace.name ? { name: workspace.name } : {}),
      ...(workspace.root ? { root: workspace.root } : {}),
      ...(input.assessment.profile
        ? { profile: input.assessment.profile }
        : {}),
    },
    summary: buildSummary(finalizedNodes, finalizedEdges),
    nodes: finalizedNodes,
    edges: finalizedEdges,
    facets: buildFacets(finalizedNodes, finalizedEdges),
  };
}

function buildFindings(
  input: GovernanceGraphBuilderInput
): DraftGraphFinding[] {
  const findings = [...(input.signals ?? [])]
    .map(mapSignalToFinding)
    .sort(compareFindings);
  const findingKeys = new Set(findings.map(buildFindingIdentity));

  for (const violation of [...input.assessment.violations].sort(
    compareViolations
  )) {
    const finding = mapViolationToFinding(violation);
    const findingKey = buildFindingIdentity(finding);
    if (!findingKeys.has(findingKey)) {
      findings.push(finding);
      findingKeys.add(findingKey);
    }
  }

  return findings.sort(compareFindings);
}

function mapSignalToFinding(signal: GovernanceSignal): DraftGraphFinding {
  return {
    id: signal.id,
    source: mapSignalSource(signal.source),
    severity: signal.severity,
    message: signal.message,
    ...(readRuleId(signal.metadata)
      ? { ruleId: readRuleId(signal.metadata) }
      : {}),
    ...(signal.sourceProjectId ? { projectId: signal.sourceProjectId } : {}),
    ...(signal.targetProjectId
      ? { targetProjectId: signal.targetProjectId }
      : {}),
    category: signal.category,
    type: signal.type,
    ...(signal.sourcePluginId ? { sourcePluginId: signal.sourcePluginId } : {}),
    relatedProjectIds: uniqueSorted([
      signal.sourceProjectId,
      signal.targetProjectId,
      ...signal.relatedProjectIds,
    ]),
  };
}

function mapViolationToFinding(violation: Violation): DraftGraphFinding {
  const projectId = normalizeText(violation.project);
  const targetProjectId = normalizeText(
    asString(violation.details?.targetProject)
  );

  return {
    id: violation.id,
    source: violation.sourcePluginId ? 'extension' : 'policy',
    severity: violation.severity,
    message: violation.message,
    ruleId: violation.ruleId,
    ...(projectId ? { projectId } : {}),
    ...(targetProjectId ? { targetProjectId } : {}),
    category: violation.category,
    ...(violation.sourcePluginId
      ? { sourcePluginId: violation.sourcePluginId }
      : {}),
    relatedProjectIds: uniqueSorted([projectId, targetProjectId]),
  };
}

function resolveEdgeForFinding(
  finding: DraftGraphFinding,
  edgesByPair: Map<string, DraftGraphEdge[]>
): DraftGraphEdge | undefined {
  if (!finding.projectId || !finding.targetProjectId) {
    return undefined;
  }

  return edgesByPair.get(
    buildEdgePairKey(finding.projectId, finding.targetProjectId)
  )?.[0];
}

function resolveNodeForFinding(
  finding: DraftGraphFinding,
  nodes: Map<string, DraftGraphNode>
): DraftGraphNode | undefined {
  const candidates = uniqueSorted([
    finding.projectId,
    finding.targetProjectId,
    ...finding.relatedProjectIds,
  ]);

  for (const candidate of candidates) {
    const node = nodes.get(candidate);
    if (node) {
      return node;
    }
  }

  return undefined;
}

function buildSummary(
  nodes: GovernanceGraphNode[],
  edges: GovernanceGraphEdge[]
): GovernanceGraphSummary {
  const nodeHealthCounts = countHealth(nodes.map((node) => node.health));
  const edgeHealthCounts = countHealth(edges.map((edge) => edge.health));

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    findingCount:
      nodes.reduce((total, node) => total + node.findings.length, 0) +
      edges.reduce((total, edge) => total + edge.findings.length, 0),
    healthyNodeCount: nodeHealthCounts.healthy,
    warningNodeCount: nodeHealthCounts.warning,
    criticalNodeCount: nodeHealthCounts.critical,
    unknownNodeCount: nodeHealthCounts.unknown,
    healthyEdgeCount: edgeHealthCounts.healthy,
    warningEdgeCount: edgeHealthCounts.warning,
    criticalEdgeCount: edgeHealthCounts.critical,
    unknownEdgeCount: edgeHealthCounts.unknown,
  };
}

function buildFacets(
  nodes: GovernanceGraphNode[],
  edges: GovernanceGraphEdge[]
): GovernanceGraphFacets {
  const findings = [
    ...nodes.flatMap((node) => node.findings),
    ...edges.flatMap((edge) => edge.findings),
  ];

  return {
    health: uniqueSorted([
      ...nodes.map((node) => node.health),
      ...edges.map((edge) => edge.health),
    ]).sort(compareHealth),
    tags: uniqueSorted(nodes.flatMap((node) => node.tags)),
    owners: uniqueSorted(
      nodes
        .map((node) => node.owner)
        .filter((owner): owner is string => typeof owner === 'string')
    ),
    findingSources: uniqueSorted(
      findings.map((finding) => finding.source)
    ).sort(compareFindingSources),
    findingSeverities: uniqueSorted(
      findings.map((finding) => finding.severity)
    ).sort(compareFindingSeverity),
    ruleIds: uniqueSorted(
      findings
        .map((finding) => finding.ruleId)
        .filter((ruleId): ruleId is string => typeof ruleId === 'string')
    ),
  };
}

function deriveHealth(
  findings: DraftGraphFinding[],
  isKnown: boolean
): GovernanceGraphHealth {
  if (findings.some((finding) => finding.severity === 'error')) {
    return 'critical';
  }

  if (findings.some((finding) => finding.severity === 'warning')) {
    return 'warning';
  }

  if (isKnown) {
    return 'healthy';
  }

  return 'unknown';
}

function countHealth(
  healthValues: GovernanceGraphHealth[]
): Record<GovernanceGraphHealth, number> {
  return healthValues.reduce<Record<GovernanceGraphHealth, number>>(
    (counts, health) => {
      counts[health] += 1;
      return counts;
    },
    {
      healthy: 0,
      warning: 0,
      critical: 0,
      unknown: 0,
    }
  );
}

function compareProjects(
  left: GovernanceProject,
  right: GovernanceProject
): number {
  return (
    left.id.localeCompare(right.id) ||
    left.name.localeCompare(right.name) ||
    left.root.localeCompare(right.root)
  );
}

function compareDependencies(
  left: GovernanceDependency,
  right: GovernanceDependency
): number {
  return (
    left.source.localeCompare(right.source) ||
    left.target.localeCompare(right.target) ||
    left.type.localeCompare(right.type) ||
    (left.sourceFile ?? '').localeCompare(right.sourceFile ?? '')
  );
}

function compareFindings(
  left: DraftGraphFinding,
  right: DraftGraphFinding
): number {
  return (
    compareFindingSeverity(left.severity, right.severity) ||
    compareFindingSources(left.source, right.source) ||
    (left.ruleId ?? '').localeCompare(right.ruleId ?? '') ||
    (left.projectId ?? '').localeCompare(right.projectId ?? '') ||
    (left.targetProjectId ?? '').localeCompare(right.targetProjectId ?? '') ||
    left.relatedProjectIds
      .join(',')
      .localeCompare(right.relatedProjectIds.join(',')) ||
    (left.category ?? '').localeCompare(right.category ?? '') ||
    (left.type ?? '').localeCompare(right.type ?? '') ||
    left.message.localeCompare(right.message) ||
    left.id.localeCompare(right.id)
  );
}

function compareGraphNodes(
  left: GovernanceGraphNode,
  right: GovernanceGraphNode
): number {
  return (
    left.id.localeCompare(right.id) || left.label.localeCompare(right.label)
  );
}

function compareGraphEdges(
  left: GovernanceGraphEdge,
  right: GovernanceGraphEdge
): number {
  return (
    left.source.localeCompare(right.source) ||
    left.target.localeCompare(right.target) ||
    left.type.localeCompare(right.type) ||
    left.id.localeCompare(right.id)
  );
}

function compareFindingSources(
  left: GovernanceGraphFindingSource,
  right: GovernanceGraphFindingSource
): number {
  return FINDING_SOURCE_ORDER[left] - FINDING_SOURCE_ORDER[right];
}

function compareFindingSeverity(
  left: GovernanceSignalSeverity,
  right: GovernanceSignalSeverity
): number {
  return FINDING_SEVERITY_ORDER[left] - FINDING_SEVERITY_ORDER[right];
}

function compareHealth(
  left: GovernanceGraphHealth,
  right: GovernanceGraphHealth
): number {
  return HEALTH_ORDER[left] - HEALTH_ORDER[right];
}

function compareViolations(left: Violation, right: Violation): number {
  return (
    compareFindingSeverity(left.severity, right.severity) ||
    left.ruleId.localeCompare(right.ruleId) ||
    left.project.localeCompare(right.project) ||
    left.message.localeCompare(right.message) ||
    left.id.localeCompare(right.id)
  );
}

function buildEdgeId(dependency: GovernanceDependency): string {
  return [dependency.source, dependency.target, dependency.type].join('->');
}

function buildEdgePairKey(source: string, target: string): string {
  return `${source}|${target}`;
}

function buildFindingIdentity(finding: DraftGraphFinding): string {
  return [
    finding.source,
    finding.severity,
    finding.ruleId ?? '',
    finding.projectId ?? '',
    finding.targetProjectId ?? '',
    finding.relatedProjectIds.join(','),
    finding.sourcePluginId ?? '',
    finding.message,
  ].join('|');
}

function mapSignalSource(
  source: GovernanceSignal['source']
): GovernanceGraphFindingSource {
  if (source === 'conformance') {
    return 'conformance';
  }

  if (source === 'policy') {
    return 'policy';
  }

  if (source === 'extension') {
    return 'extension';
  }

  return 'signal';
}

function readOwner(project: GovernanceProject): string | undefined {
  return (
    normalizeText(project.ownership?.team) ??
    normalizeText(project.ownership?.contacts?.[0])
  );
}

function readRuleId(
  metadata: Record<string, unknown> | undefined
): string | undefined {
  return normalizeText(asString(metadata?.ruleId));
}

function serializeProjectMetadata(
  metadata: Record<string, unknown>
): Record<string, string | number | boolean | null> | undefined {
  const normalizedEntries = Object.entries(metadata)
    .map(([key, value]) => [key, toSerializablePrimitive(value)] as const)
    .filter(
      (entry): entry is [string, string | number | boolean | null] =>
        entry[1] !== undefined
    )
    .sort(([left], [right]) => left.localeCompare(right));

  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(normalizedEntries);
}

function toSerializablePrimitive(
  value: unknown
): string | number | boolean | null | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value === null) {
    return null;
  }

  return undefined;
}

function stripRelatedProjects(
  finding: DraftGraphFinding
): GovernanceGraphFinding {
  return {
    id: finding.id,
    source: finding.source,
    severity: finding.severity,
    message: finding.message,
    ...(finding.ruleId ? { ruleId: finding.ruleId } : {}),
    ...(finding.projectId ? { projectId: finding.projectId } : {}),
    ...(finding.targetProjectId
      ? { targetProjectId: finding.targetProjectId }
      : {}),
    ...(finding.category ? { category: finding.category } : {}),
    ...(finding.type ? { type: finding.type } : {}),
    ...(finding.sourcePluginId
      ? { sourcePluginId: finding.sourcePluginId }
      : {}),
  };
}

function uniqueSorted<T extends string>(values: Array<T | undefined>): T[] {
  const filtered = values.filter(
    (value): value is T => typeof value === 'string' && value.length > 0
  );

  return [...new Set(filtered)].sort((left, right) =>
    left.localeCompare(right)
  );
}

function normalizeText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

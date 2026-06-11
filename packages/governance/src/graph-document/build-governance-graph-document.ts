import type {
  GovernanceAssessment,
  GovernanceSignal,
  GovernanceSignalSeverity,
  Violation,
} from '@anarchitects/governance-core';
import type { GovernanceAssessmentArtifacts } from '../plugin/build-assessment-artifacts.js';
import {
  buildGovernanceRenderingModel,
  type RenderableCanonicalNode,
  type RenderableCanonicalRelation,
} from '../reporting/canonical-rendering-model.js';
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
import {
  deriveGovernanceGraphEdgeStatus,
  deriveGovernanceGraphNodeStatus,
} from './derive-governance-graph-status.js';

export interface GovernanceGraphBuilderInput {
  assessment: GovernanceAssessment;
  artifacts?: GovernanceAssessmentArtifacts;
  signals?: GovernanceSignal[];
  generatedAt?: string;
  schemaVersion?: string;
  ownershipRequired?: boolean;
  documentationRequired?: boolean;
}

interface DraftGraphFinding extends GovernanceGraphFinding {
  relatedProjectIds: string[];
}

interface DraftGraphNode {
  node: Omit<GovernanceGraphNode, 'health' | 'score' | 'badges' | 'findings'>;
  findings: DraftGraphFinding[];
}

interface DraftGraphEdge {
  edge: Omit<GovernanceGraphEdge, 'health' | 'score' | 'findings'>;
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
  unknown: 2,
  healthy: 3,
};

/**
 * Builds a stable, JSON-serializable graph document from governance artifacts.
 */
export function buildGovernanceGraphDocument(
  input: GovernanceGraphBuilderInput
): GovernanceGraphDocument {
  const renderingModel = buildGovernanceRenderingModel(
    input.artifacts ?? input.assessment
  );
  const workspace = renderingModel.assessment.workspace;
  const ownershipRequired = resolveOwnershipRequirement(input);
  const documentationRequired = resolveDocumentationRequirement(input);
  const nodes = [...renderingModel.nodes].sort(compareNodes);
  const edges = [...renderingModel.relations].sort(compareRelations);

  const nodeDrafts = new Map<string, DraftGraphNode>(
    nodes.map((nodeInput) => {
      const owner = readNodeOwner(nodeInput);
      const metadata = serializeNodeMetadata(
        nodeInput,
        renderingModel.hasCanonicalGraph
      );

      return [
        nodeInput.id,
        {
          node: {
            id: nodeInput.id,
            label: nodeInput.name ?? nodeInput.id,
            type: readNodeType(nodeInput),
            tags: uniqueSorted([
              ...(nodeInput.tags ?? []),
              ...(nodeInput.classification?.tags ?? []),
            ]),
            ...(owner ? { owner } : {}),
            ...(metadata ? { metadata } : {}),
          },
          findings: [],
        },
      ];
    })
  );

  const edgeDrafts = new Map<string, DraftGraphEdge>(
    edges.map((relation) => {
      const edgeId = buildEdgeId(relation);
      return [
        edgeId,
        {
          edge: {
            id: edgeId,
            source: relation.sourceNodeId,
            target: relation.targetNodeId,
            type: readRelationType(relation),
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
    .map(({ node, findings }) => {
      const sortedFindings = [...findings].sort(compareFindings);
      const resolvedNode = nodes.find((candidate) => candidate.id === node.id);
      const nodeStatus = deriveGovernanceGraphNodeStatus({
        findings: sortedFindings.map(stripRelatedProjects),
        owner: node.owner,
        ownershipSource: normalizeOwnershipSource(
          resolvedNode?.ownership?.source
        ),
        ownershipRequired,
        documentation: node.metadata?.documentation,
        documentationRequired,
        isKnown: isKnownNode(resolvedNode),
      });

      return {
        ...node,
        findings: sortedFindings.map(stripRelatedProjects),
        badges: nodeStatus.badges,
        health: nodeStatus.health,
        score: nodeStatus.score,
      };
    })
    .sort(compareGraphNodes);

  const finalizedEdges = [...edgeDrafts.values()]
    .map(({ edge, findings }) => {
      const sortedFindings = [...findings].sort(compareFindings);
      const edgeStatus = deriveGovernanceGraphEdgeStatus({
        findings: sortedFindings.map(stripRelatedProjects),
        isKnown: isKnownEdge(edge),
      });

      return {
        ...edge,
        findings: sortedFindings.map(stripRelatedProjects),
        health: edgeStatus.health,
        score: edgeStatus.score,
      };
    })
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
  const projectId = normalizeText(signal.nodeId);
  const relatedProjectIds = uniqueSorted([
    projectId,
    ...(signal.relatedNodeIds ?? []),
  ]);
  const targetProjectId =
    relatedProjectIds.find((candidate) => candidate !== projectId) ??
    normalizeText(signal.relationId);

  return {
    id: signal.id,
    source: mapSignalSource(signal.source),
    severity: signal.severity,
    message: signal.message,
    ...(readRuleId(signal.metadata)
      ? { ruleId: readRuleId(signal.metadata) }
      : {}),
    ...(projectId ? { projectId } : {}),
    ...(targetProjectId ? { targetProjectId } : {}),
    category: signal.category,
    type: signal.type,
    ...(signal.sourcePluginId ? { sourcePluginId: signal.sourcePluginId } : {}),
    relatedProjectIds,
  };
}

function mapViolationToFinding(violation: Violation): DraftGraphFinding {
  const projectId = normalizeText(
    violation.subjectId ?? violation.reference?.nodeId
  );
  const relatedProjectIds = uniqueSorted([
    projectId,
    ...(violation.reference?.relatedNodeIds ?? []),
  ]);
  const targetProjectId =
    normalizeText(asString(violation.details?.targetProject)) ??
    relatedProjectIds.find((candidate) => candidate !== projectId) ??
    normalizeText(violation.reference?.relationId);

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
    relatedProjectIds,
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

function compareNodes(
  left: RenderableCanonicalNode,
  right: RenderableCanonicalNode
): number {
  return (
    left.id.localeCompare(right.id) ||
    (left.name ?? '').localeCompare(right.name ?? '') ||
    (left.root ?? left.path ?? '').localeCompare(right.root ?? right.path ?? '')
  );
}

function compareRelations(
  left: RenderableCanonicalRelation,
  right: RenderableCanonicalRelation
): number {
  return (
    left.sourceNodeId.localeCompare(right.sourceNodeId) ||
    left.targetNodeId.localeCompare(right.targetNodeId) ||
    readRelationType(left).localeCompare(readRelationType(right)) ||
    readMetadataString(left.metadata, 'sourceFile').localeCompare(
      readMetadataString(right.metadata, 'sourceFile')
    )
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
  const leftProjectId =
    left.subjectId ??
    left.reference?.nodeId ??
    left.reference?.relationId ??
    '';
  const rightProjectId =
    right.subjectId ??
    right.reference?.nodeId ??
    right.reference?.relationId ??
    '';

  return (
    compareFindingSeverity(left.severity, right.severity) ||
    left.ruleId.localeCompare(right.ruleId) ||
    leftProjectId.localeCompare(rightProjectId) ||
    left.message.localeCompare(right.message) ||
    left.id.localeCompare(right.id)
  );
}

function buildEdgeId(relation: RenderableCanonicalRelation): string {
  return [
    relation.sourceNodeId,
    relation.targetNodeId,
    readRelationType(relation),
  ].join('->');
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

function resolveOwnershipRequirement(
  input: GovernanceGraphBuilderInput
): boolean | undefined {
  if (typeof input.ownershipRequired === 'boolean') {
    return input.ownershipRequired;
  }

  return input.assessment.measurements.some(
    (measurement) => measurement.id === 'ownership-coverage'
  )
    ? true
    : undefined;
}

function resolveDocumentationRequirement(
  input: GovernanceGraphBuilderInput
): boolean | undefined {
  if (typeof input.documentationRequired === 'boolean') {
    return input.documentationRequired;
  }

  return input.assessment.measurements.some(
    (measurement) => measurement.id === 'documentation-completeness'
  )
    ? true
    : undefined;
}

function isKnownNode(node: RenderableCanonicalNode | undefined): boolean {
  if (!node) {
    return false;
  }

  return Boolean(node.id && (node.name || node.id) && (node.root || node.path));
}

function isKnownEdge(
  edge: Pick<GovernanceGraphEdge, 'source' | 'target'>
): boolean {
  return Boolean(edge.source && edge.target);
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

function readNodeOwner(node: RenderableCanonicalNode): string | undefined {
  return (
    normalizeText(node.ownership?.team) ??
    normalizeText(node.ownership?.contacts?.[0])
  );
}

function readNodeType(node: RenderableCanonicalNode): string {
  return (
    readNestedMetadataString(node.metadata, ['nx', 'projectType']) ??
    readOptionalMetadataString(node.metadata, 'projectType') ??
    normalizeText(node.kind) ??
    'unknown'
  );
}

function readRelationType(relation: RenderableCanonicalRelation): string {
  return (
    readOptionalMetadataString(relation.metadata, 'dependencyType') ??
    normalizeText(relation.kind) ??
    'unknown'
  );
}

function readRuleId(
  metadata: Record<string, unknown> | undefined
): string | undefined {
  return normalizeText(asString(metadata?.ruleId));
}

function serializeNodeMetadata(
  node: RenderableCanonicalNode,
  preserveComplexMetadata: boolean
): Record<string, string | number | boolean | null> | undefined {
  const metadata = preserveComplexMetadata
    ? {
        ...(node.metadata ?? {}),
        ...(node.sourceSystem ? { sourceSystem: node.sourceSystem } : {}),
        ...(node.kind ? { kind: node.kind } : {}),
        ...(node.root ? { root: node.root } : {}),
        ...(node.path ? { path: node.path } : {}),
        ...(node.classification?.domain
          ? { domain: node.classification.domain }
          : {}),
        ...(node.classification?.layer
          ? { layer: node.classification.layer }
          : {}),
        ...(node.classification?.scope
          ? { scope: node.classification.scope }
          : {}),
      }
    : node.metadata ?? {};
  const normalizedEntries = Object.entries(metadata)
    .map(
      ([key, value]) =>
        [key, toSerializablePrimitive(value, preserveComplexMetadata)] as const
    )
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
  value: unknown,
  preserveComplexMetadata = false
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

  if (preserveComplexMetadata && (Array.isArray(value) || isRecord(value))) {
    return stableStringify(value);
  }

  return undefined;
}

function normalizeOwnershipSource(
  source: string | undefined
): 'project-metadata' | 'codeowners' | 'merged' | 'none' | undefined {
  if (
    source === 'project-metadata' ||
    source === 'codeowners' ||
    source === 'merged' ||
    source === 'none'
  ) {
    return source;
  }

  return undefined;
}

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
): string {
  return normalizeText(asString(metadata?.[key])) ?? '';
}

function readOptionalMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  return normalizeText(asString(metadata?.[key]));
}

function readNestedMetadataString(
  metadata: Record<string, unknown> | undefined,
  path: string[]
): string | undefined {
  let current: unknown = metadata;

  for (const key of path) {
    const record = isRecord(current) ? current : undefined;
    if (!record) {
      return undefined;
    }
    current = record[key];
  }

  return normalizeText(asString(current));
}

function stableStringify(value: unknown): string | undefined {
  try {
    return JSON.stringify(sortJsonValue(value));
  } catch {
    return undefined;
  }
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortJsonValue(nestedValue)])
    );
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

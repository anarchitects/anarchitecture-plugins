import type {
  GovernanceAssessment,
  GovernanceCapability,
  GovernanceDiagnostic,
  GovernanceSignal,
  GovernanceWorkspace,
} from '@anarchitects/governance-core';

import type { GovernanceExtensionDiagnostic } from '../extensions/diagnostics.js';
import type { GovernanceAssessmentArtifacts } from '../plugin/build-assessment-artifacts.js';

type GovernanceEvidence = {
  id: string;
  type: string;
  [key: string]: unknown;
};

export interface RenderableCanonicalNode {
  id: string;
  name?: string;
  kind?: string;
  sourceSystem?: string;
  technology?: string;
  root?: string;
  path?: string;
  tags?: string[];
  classification?: {
    domain?: string;
    layer?: string;
    scope?: string;
    tags?: string[];
  };
  ownership?: {
    team?: string;
    contacts?: string[];
    source?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface RenderableCanonicalRelation {
  id: string;
  sourceNodeId: string;
  sourceNodeName?: string;
  targetNodeId: string;
  targetNodeName?: string;
  kind?: string;
  metadata?: Record<string, unknown>;
  evidence?: GovernanceEvidence[];
}

export interface GovernanceRenderingModel {
  assessment: GovernanceAssessment;
  nodes: RenderableCanonicalNode[];
  relations: RenderableCanonicalRelation[];
  signals: GovernanceSignal[];
  capabilities: GovernanceCapability[];
  diagnostics: GovernanceDiagnostic[];
  extensionDiagnostics: GovernanceExtensionDiagnostic[];
  hasCanonicalGraph: boolean;
}

interface CanonicalClassificationShape {
  domain?: string;
  layer?: string;
  scope?: string;
  tags?: string[];
}

interface CanonicalOwnershipShape {
  team?: string;
  contacts?: string[];
  source?: string;
}

interface CanonicalNodeShape {
  id: string;
  name?: string;
  kind?: string;
  sourceSystem?: string;
  technology?: string;
  root?: string;
  path?: string;
  tags?: string[];
  classification?: CanonicalClassificationShape;
  ownership?: CanonicalOwnershipShape;
  metadata?: Record<string, unknown>;
}

interface CanonicalRelationShape {
  id?: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind?: string;
  metadata?: Record<string, unknown>;
  evidence?: GovernanceEvidence[];
}

interface CanonicalWorkspaceShape {
  id: string;
  name: string;
  root: string;
  nodes?: CanonicalNodeShape[];
  relations?: CanonicalRelationShape[];
}

export type GovernanceRendererInput =
  | GovernanceAssessment
  | GovernanceAssessmentArtifacts;

export function buildGovernanceRenderingModel(
  input: GovernanceRendererInput
): GovernanceRenderingModel {
  if (isAssessmentArtifacts(input)) {
    return buildGovernanceRenderingModelFromAssessment(input.assessment, input);
  }

  return buildGovernanceRenderingModelFromAssessment(input);
}

export function buildNodeLabelMap(
  nodes: RenderableCanonicalNode[]
): Map<string, string> {
  return new Map(
    [...nodes]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((node) => [node.id, `${node.name ?? node.id} [${node.id}]`])
  );
}

export function buildRelationLabelMap(
  relations: RenderableCanonicalRelation[],
  nodeLabels: ReadonlyMap<string, string>
): Map<string, string> {
  return new Map(
    [...relations]
      .sort((left, right) =>
        relationSortKey(left).localeCompare(relationSortKey(right))
      )
      .map((relation) => [
        relation.id,
        `${nodeLabels.get(relation.sourceNodeId) ?? relation.sourceNodeId} -> ${
          nodeLabels.get(relation.targetNodeId) ?? relation.targetNodeId
        } [${relation.id}]`,
      ])
  );
}

export function toRenderableNode(
  node: CanonicalNodeShape
): RenderableCanonicalNode {
  return {
    id: node.id,
    ...(node.name ? { name: node.name } : {}),
    ...(node.kind ? { kind: node.kind } : {}),
    ...(node.sourceSystem ? { sourceSystem: node.sourceSystem } : {}),
    ...(node.technology ? { technology: node.technology } : {}),
    ...(node.root ? { root: node.root } : {}),
    ...(node.path ? { path: node.path } : {}),
    ...(node.tags && node.tags.length > 0 ? { tags: [...node.tags] } : {}),
    ...(node.classification
      ? {
          classification: {
            ...node.classification,
            ...(node.classification.tags
              ? { tags: [...node.classification.tags] }
              : {}),
          },
        }
      : {}),
    ...(node.ownership
      ? {
          ownership: {
            ...node.ownership,
            ...(node.ownership.contacts
              ? { contacts: [...node.ownership.contacts] }
              : {}),
          },
        }
      : {}),
    ...(node.metadata ? { metadata: cloneRecord(node.metadata) } : {}),
  };
}

export function toRenderableRelation(
  relation: CanonicalRelationShape,
  nodeLabels: ReadonlyMap<string, string>
): RenderableCanonicalRelation {
  const relationId =
    relation.id ??
    `${relation.sourceNodeId}->${relation.targetNodeId}:${relation.kind ?? ''}`;

  return {
    id: relationId,
    sourceNodeId: relation.sourceNodeId,
    ...readResolvedNodeName(nodeLabels, relation.sourceNodeId, 'source'),
    targetNodeId: relation.targetNodeId,
    ...readResolvedNodeName(nodeLabels, relation.targetNodeId, 'target'),
    ...(relation.kind ? { kind: relation.kind } : {}),
    ...(relation.metadata ? { metadata: cloneRecord(relation.metadata) } : {}),
    ...(relation.evidence ? { evidence: [...relation.evidence] } : {}),
  };
}

function buildGovernanceRenderingModelFromAssessment(
  assessment: GovernanceAssessment,
  artifacts?: GovernanceAssessmentArtifacts
): GovernanceRenderingModel {
  const workspace = asCanonicalWorkspace(assessment.workspace);
  const nodes = readCanonicalNodes(workspace)
    .map(toRenderableNode)
    .sort((left, right) => left.id.localeCompare(right.id));
  const nodeLabels = buildNodeLabelMap(nodes);
  const relations = readCanonicalRelations(workspace)
    .map((relation) => toRenderableRelation(relation, nodeLabels))
    .sort((left, right) =>
      relationSortKey(left).localeCompare(relationSortKey(right))
    );

  return {
    assessment,
    nodes,
    relations,
    signals: artifacts?.signals ?? [],
    capabilities: artifacts?.capabilities ?? [],
    diagnostics:
      artifacts?.diagnostics ?? artifacts?.adapterResult?.diagnostics ?? [],
    extensionDiagnostics: artifacts?.extensionDiagnostics ?? [],
    hasCanonicalGraph: nodes.length > 0 || relations.length > 0,
  };
}

function isAssessmentArtifacts(
  input: GovernanceRendererInput
): input is GovernanceAssessmentArtifacts {
  return typeof input === 'object' && input !== null && 'assessment' in input;
}

function asCanonicalWorkspace(
  workspace: GovernanceWorkspace
): CanonicalWorkspaceShape {
  return workspace as unknown as CanonicalWorkspaceShape;
}

function readCanonicalNodes(
  workspace: CanonicalWorkspaceShape
): CanonicalNodeShape[] {
  const nodes = Array.isArray(workspace.nodes) ? workspace.nodes : [];

  return nodes.map(cloneCanonicalNode);
}

function readCanonicalRelations(
  workspace: CanonicalWorkspaceShape
): CanonicalRelationShape[] {
  const relations = Array.isArray(workspace.relations)
    ? workspace.relations
    : [];

  return relations.map(cloneCanonicalRelation);
}

function cloneCanonicalNode(node: CanonicalNodeShape): CanonicalNodeShape {
  return {
    ...node,
    ...(node.tags ? { tags: [...node.tags] } : {}),
    ...(node.classification
      ? {
          classification: {
            ...node.classification,
            ...(node.classification.tags
              ? { tags: [...node.classification.tags] }
              : {}),
          },
        }
      : {}),
    ...(node.ownership
      ? {
          ownership: {
            ...node.ownership,
            ...(node.ownership.contacts
              ? { contacts: [...node.ownership.contacts] }
              : {}),
          },
        }
      : {}),
    ...(node.metadata ? { metadata: cloneRecord(node.metadata) } : {}),
  };
}

function cloneCanonicalRelation(
  relation: CanonicalRelationShape
): CanonicalRelationShape {
  return {
    ...relation,
    ...(relation.metadata ? { metadata: cloneRecord(relation.metadata) } : {}),
    ...(relation.evidence ? { evidence: [...relation.evidence] } : {}),
  };
}

function relationSortKey(
  relation: Pick<
    RenderableCanonicalRelation,
    'id' | 'sourceNodeId' | 'targetNodeId' | 'kind'
  >
): string {
  return `${relation.id}|${relation.sourceNodeId}|${relation.targetNodeId}|${
    relation.kind ?? ''
  }`;
}

function readResolvedNodeName(
  nodeLabels: ReadonlyMap<string, string>,
  nodeId: string,
  side: 'source' | 'target'
): Partial<
  Pick<RenderableCanonicalRelation, 'sourceNodeName' | 'targetNodeName'>
> {
  const label = nodeLabels.get(nodeId);
  if (!label) {
    return {};
  }

  return side === 'source'
    ? { sourceNodeName: stripNodeIdSuffix(label) }
    : { targetNodeName: stripNodeIdSuffix(label) };
}

function stripNodeIdSuffix(label: string): string {
  const suffixIndex = label.lastIndexOf(' [');
  return suffixIndex >= 0 ? label.slice(0, suffixIndex) : label;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, cloneUnknown(entry)])
  );
}

function cloneUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cloneUnknown);
  }

  if (value && typeof value === 'object') {
    return cloneRecord(value as Record<string, unknown>);
  }

  return value;
}

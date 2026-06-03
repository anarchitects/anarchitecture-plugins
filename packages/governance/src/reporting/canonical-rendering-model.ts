import type {
  GovernanceAssessment,
  GovernanceCapability,
  GovernanceDiagnostic,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

import type { GovernanceExtensionDiagnostic } from '../extensions/diagnostics.js';
import type { GovernanceAssessmentArtifacts } from '../plugin/build-assessment-artifacts.js';

export interface RenderableCanonicalNode {
  id: string;
  name?: string;
  kind?: string;
  sourceSystem?: string;
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
  id?: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind?: string;
  metadata?: Record<string, unknown>;
}

export interface GovernanceRenderingModel {
  assessment: GovernanceAssessment;
  nodes: RenderableCanonicalNode[];
  relations: RenderableCanonicalRelation[];
  capabilities: GovernanceCapability[];
  diagnostics: GovernanceDiagnostic[];
  extensionDiagnostics: GovernanceExtensionDiagnostic[];
  hasCanonicalGraph: boolean;
}

type AdapterResultWithCanonicalGraph = GovernanceWorkspaceAdapterResult & {
  nodes?: RenderableCanonicalNode[];
  relations?: RenderableCanonicalRelation[];
};

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

function buildGovernanceRenderingModelFromAssessment(
  assessment: GovernanceAssessment,
  artifacts?: GovernanceAssessmentArtifacts
): GovernanceRenderingModel {
  const adapterResult = artifacts?.adapterResult as
    | AdapterResultWithCanonicalGraph
    | undefined;

  const canonicalNodes = adapterResult?.nodes;
  const canonicalRelations = adapterResult?.relations;

  return {
    assessment,
    nodes:
      canonicalNodes && canonicalNodes.length > 0
        ? canonicalNodes
        : assessment.workspace.projects.map(projectToRenderableNode),
    relations:
      canonicalRelations && canonicalRelations.length > 0
        ? canonicalRelations
        : assessment.workspace.dependencies.map(dependencyToRenderableRelation),
    capabilities: artifacts?.capabilities ?? [],
    diagnostics: artifacts?.diagnostics ?? adapterResult?.diagnostics ?? [],
    extensionDiagnostics: artifacts?.extensionDiagnostics ?? [],
    hasCanonicalGraph:
      Boolean(canonicalNodes && canonicalNodes.length > 0) ||
      Boolean(canonicalRelations && canonicalRelations.length > 0),
  };
}

function isAssessmentArtifacts(
  input: GovernanceRendererInput
): input is GovernanceAssessmentArtifacts {
  return typeof input === 'object' && input !== null && 'assessment' in input;
}

function projectToRenderableNode(
  project: GovernanceAssessment['workspace']['projects'][number]
): RenderableCanonicalNode {
  return {
    id: project.id,
    name: project.name,
    kind: project.type,
    root: project.root,
    path: project.root,
    tags: project.tags,
    classification: {
      ...(project.domain ? { domain: project.domain } : {}),
      ...(project.layer ? { layer: project.layer } : {}),
      ...(project.tags.length > 0 ? { tags: project.tags } : {}),
    },
    ownership: project.ownership,
    metadata: project.metadata,
  };
}

function dependencyToRenderableRelation(
  dependency: GovernanceAssessment['workspace']['dependencies'][number]
): RenderableCanonicalRelation {
  return {
    sourceNodeId: dependency.source,
    targetNodeId: dependency.target,
    kind: dependency.type,
    metadata: {
      dependencyType: dependency.type,
      ...(dependency.sourceFile ? { sourceFile: dependency.sourceFile } : {}),
    },
  };
}

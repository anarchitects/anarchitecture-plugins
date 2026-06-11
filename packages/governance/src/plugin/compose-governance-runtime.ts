import {
  buildGovernanceAssessmentArtifacts as buildCoreGovernanceAssessmentArtifacts,
  buildGovernanceWorkspace,
  DefaultGovernanceCapabilityRegistry,
  type GovernanceAssessmentArtifacts,
  type GovernanceCapability,
  type GovernanceExtensionHostContext,
  type GovernanceExtensionRegistrationResult,
  type GovernanceProfile,
  type GovernanceWorkspace,
  type GovernanceWorkspaceAdapterResult,
  type ProfileOverrides,
} from '@anarchitects/governance-core';
import {
  loadNxGovernanceWorkspaceContext,
  readWorkspaceGraphSnapshot,
  summarizeWorkspaceGraph,
  type GraphAdapterOptions,
} from '@anarchitects/governance-adapter-nx';

import { loadGovernanceExtensionConfig } from '../nx-host/extensions/config.js';
import { registerNxGovernanceExtensionsWithDiagnostics } from '../nx-host/extensions/host.js';
import type { GovernanceProfileComposition } from '../profile/runtime-profile.js';

interface NxGovernanceProfileOverrides extends ProfileOverrides {
  composition?: GovernanceProfileComposition;
}

export interface RuntimeGovernanceNode {
  id: string;
  name?: string;
  kind?: string;
  technology?: string;
  sourceSystem?: string;
  root?: string;
  path?: string;
  tags?: string[];
  classification?: Record<string, unknown>;
  ownership?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface RuntimeGovernanceRelation {
  id?: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind?: string;
  metadata?: Record<string, unknown>;
}
export type RuntimeGovernanceWorkspace = Omit<
  GovernanceWorkspace,
  'projects' | 'dependencies'
> & {
  nodes: RuntimeGovernanceNode[];
  relations: RuntimeGovernanceRelation[];
  metadata?: Record<string, unknown>;
};
export type RuntimeGovernanceExtensionContext = Omit<
  GovernanceExtensionHostContext,
  'inventory'
> & {
  inventory: RuntimeGovernanceWorkspace;
};
type CanonicalAdapterResult = GovernanceWorkspaceAdapterResult & {
  workspace?: Partial<RuntimeGovernanceWorkspace>;
  nodes?: RuntimeGovernanceNode[];
  relations?: RuntimeGovernanceRelation[];
};

export interface ComposeNxGovernanceRuntimeInput {
  workspaceRoot: string;
  profileName: string;
  options: Readonly<Record<string, unknown>>;
  profile: GovernanceProfile;
  profileOverrides: NxGovernanceProfileOverrides;
  warnings?: string[];
  exceptions?: ProfileOverrides['exceptions'];
  conformanceFindings?: Parameters<
    typeof buildCoreGovernanceAssessmentArtifacts
  >[0]['conformanceFindings'];
  asOf?: Date;
}

export interface ComposeNxGovernanceRuntimeResult {
  adapterResult: GovernanceWorkspaceAdapterResult;
  workspace: RuntimeGovernanceWorkspace;
  adapterCapabilities: GovernanceCapability[];
  extensionContext: RuntimeGovernanceExtensionContext;
  extensionRegistration: GovernanceExtensionRegistrationResult;
  artifacts: GovernanceAssessmentArtifacts;
}

export type NxGovernanceWorkspaceGraphSummaryInput = GraphAdapterOptions;

export interface NxGovernanceWorkspaceGraphSummary {
  nodeCount: number;
  relationCount: number;
  dependencyRelationCount?: number;
}

export interface NxGovernanceWorkspaceGraphSummaryResult {
  summary: NxGovernanceWorkspaceGraphSummary;
  source: 'host-canonical-workspace' | 'adapter-graph-json';
}

export async function composeNxGovernanceRuntime(
  input: ComposeNxGovernanceRuntimeInput
): Promise<ComposeNxGovernanceRuntimeResult> {
  const { adapterResult } = await loadNxGovernanceWorkspaceContext();
  const workspace = buildGovernanceWorkspace(
    adapterResult,
    input.profileOverrides
  ) as unknown as RuntimeGovernanceWorkspace;

  const profileComposition = input.profileOverrides.composition ?? {};
  loadGovernanceExtensionConfig({
    workspaceRoot: input.workspaceRoot,
    profileComposition,
  });

  const adapterCapabilities = adapterResult.capabilities ?? [];
  const extensionContext: RuntimeGovernanceExtensionContext = {
    workspaceRoot: input.workspaceRoot,
    profileName: input.profileName,
    options: {
      ...input.options,
      profileComposition,
    },
    inventory: workspace,
    capabilities: new DefaultGovernanceCapabilityRegistry(adapterCapabilities),
  };
  const extensionRegistration =
    await registerNxGovernanceExtensionsWithDiagnostics(
      extensionContext as unknown as GovernanceExtensionHostContext,
      {
        workspaceRoot: input.workspaceRoot,
        profileComposition,
      }
    );
  const coreArtifacts = await buildCoreGovernanceAssessmentArtifacts({
    profile: input.profile,
    workspace,
    warnings: input.warnings,
    exceptions: input.exceptions,
    conformanceFindings: input.conformanceFindings ?? [],
    capabilities: adapterCapabilities,
    diagnostics: adapterResult.diagnostics ?? [],
    extensionRegistry: extensionRegistration.registry,
    extensionContext:
      extensionContext as unknown as GovernanceExtensionHostContext,
    extensionDiagnostics: extensionRegistration.diagnostics,
    asOf: input.asOf,
  });
  const artifacts = toRuntimeGovernanceAssessmentArtifacts(
    coreArtifacts,
    workspace
  );

  return {
    adapterResult,
    workspace,
    adapterCapabilities,
    extensionContext,
    extensionRegistration,
    artifacts,
  };
}

export async function summarizeNxGovernanceWorkspaceGraph(
  input: NxGovernanceWorkspaceGraphSummaryInput = {}
): Promise<NxGovernanceWorkspaceGraphSummaryResult> {
  if (input.graphJson) {
    const snapshot = await readWorkspaceGraphSnapshot({
      graphJson: input.graphJson,
    });
    const graphSummary = summarizeWorkspaceGraph(snapshot);

    return {
      summary: {
        nodeCount: graphSummary.projectCount,
        relationCount: graphSummary.dependencyCount,
        dependencyRelationCount: graphSummary.dependencyCount,
      },
      source: 'adapter-graph-json',
    };
  }

  const { adapterResult } = await loadNxGovernanceWorkspaceContext();
  const relations = readCanonicalRelations(adapterResult);

  return {
    summary: {
      nodeCount: readCanonicalNodes(adapterResult).length,
      relationCount: relations.length,
      dependencyRelationCount: countDependencyRelations(relations),
    },
    source: 'host-canonical-workspace',
  };
}

function readCanonicalNodes(
  adapterResult: GovernanceWorkspaceAdapterResult
): RuntimeGovernanceNode[] {
  const canonicalAdapterResult = adapterResult as CanonicalAdapterResult;

  return cloneRuntimeNodes(
    canonicalWorkspace(canonicalAdapterResult)?.nodes ??
      canonicalAdapterResult.nodes ??
      []
  );
}

function readCanonicalRelations(
  adapterResult: GovernanceWorkspaceAdapterResult
): RuntimeGovernanceRelation[] {
  const canonicalAdapterResult = adapterResult as CanonicalAdapterResult;

  return cloneRuntimeRelations(
    canonicalWorkspace(canonicalAdapterResult)?.relations ??
      canonicalAdapterResult.relations ??
      []
  );
}

function canonicalWorkspace(
  adapterResult: CanonicalAdapterResult
): Partial<RuntimeGovernanceWorkspace> | undefined {
  return adapterResult.workspace;
}

function countDependencyRelations(
  relations: RuntimeGovernanceRelation[]
): number {
  return relations.filter((relation) => relation.kind === 'dependency').length;
}

function toRuntimeGovernanceAssessmentArtifacts(
  artifacts: GovernanceAssessmentArtifacts,
  workspace: RuntimeGovernanceWorkspace
): GovernanceAssessmentArtifacts {
  return {
    ...artifacts,
    workspace,
    assessment: {
      ...artifacts.assessment,
      workspace,
    },
  } as unknown as GovernanceAssessmentArtifacts;
}

function cloneRuntimeNodes(
  nodes: RuntimeGovernanceNode[]
): RuntimeGovernanceNode[] {
  return nodes.map((node) => ({
    ...node,
    ...(node.tags ? { tags: [...node.tags] } : {}),
    ...(node.classification
      ? { classification: cloneRecord(node.classification) }
      : {}),
    ...(node.ownership ? { ownership: cloneRecord(node.ownership) } : {}),
    ...(node.metadata ? { metadata: cloneRecord(node.metadata) } : {}),
  }));
}

function cloneRuntimeRelations(
  relations: RuntimeGovernanceRelation[]
): RuntimeGovernanceRelation[] {
  return relations.map((relation) =>
    ensureRuntimeRelationId({
      ...relation,
      ...(relation.metadata
        ? { metadata: cloneRecord(relation.metadata) }
        : {}),
    })
  );
}

function ensureRuntimeRelationId(
  relation: RuntimeGovernanceRelation
): RuntimeGovernanceRelation {
  if (relation.id) {
    return relation;
  }

  const metadata = relation.metadata ?? {};
  const nxMetadata = asRecord(metadata['nx']);
  const dependencyType =
    readString(nxMetadata?.['dependencyType']) ??
    readString(metadata['dependencyType']) ??
    relation.kind ??
    'unknown';
  const sourceFile =
    readString(nxMetadata?.['sourceFile']) ??
    readString(metadata['sourceFile']) ??
    '';

  return {
    ...relation,
    id: `${relation.sourceNodeId}->${relation.targetNodeId}:${dependencyType}:${sourceFile}`,
  };
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

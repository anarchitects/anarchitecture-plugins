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
  const artifacts = await buildCoreGovernanceAssessmentArtifacts({
    profile: input.profile,
    workspace: workspace as unknown as GovernanceWorkspace,
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

  return (
    canonicalWorkspace(canonicalAdapterResult)?.nodes ??
    canonicalAdapterResult.nodes ??
    []
  );
}

function readCanonicalRelations(
  adapterResult: GovernanceWorkspaceAdapterResult
): RuntimeGovernanceRelation[] {
  const canonicalAdapterResult = adapterResult as CanonicalAdapterResult;

  return (
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

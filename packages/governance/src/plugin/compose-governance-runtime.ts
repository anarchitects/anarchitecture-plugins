import {
  buildGovernanceAssessmentArtifacts as buildCoreGovernanceAssessmentArtifacts,
  buildGovernanceWorkspace,
  DefaultGovernanceCapabilityRegistry,
  type GovernanceAssessmentArtifacts,
  type GovernanceCapability,
  type GovernanceExtensionHostContext,
  type GovernanceExtensionRegistrationResult,
  type GovernanceNode,
  type GovernanceProfile,
  type GovernanceRelation,
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

export type RuntimeGovernanceNode = GovernanceNode;

export type RuntimeGovernanceRelation = GovernanceRelation;

export type RuntimeGovernanceWorkspace = GovernanceWorkspace;
export type RuntimeGovernanceExtensionContext = Omit<
  GovernanceExtensionHostContext,
  'inventory'
> & {
  inventory: RuntimeGovernanceWorkspace;
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
  const workspace = buildGovernanceWorkspace(adapterResult);
  const relations = workspace.relations;

  return {
    summary: {
      nodeCount: workspace.nodes.length,
      relationCount: relations.length,
      dependencyRelationCount: countDependencyRelations(relations),
    },
    source: 'host-canonical-workspace',
  };
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

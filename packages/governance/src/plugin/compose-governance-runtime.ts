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
  type GraphSummary,
} from '@anarchitects/governance-adapter-nx';

import { loadGovernanceExtensionConfig } from '../nx-host/extensions/config.js';
import { registerNxGovernanceExtensionsWithDiagnostics } from '../nx-host/extensions/host.js';

export interface ComposeNxGovernanceRuntimeInput {
  workspaceRoot: string;
  profileName: string;
  options: Readonly<Record<string, unknown>>;
  profile: GovernanceProfile;
  profileOverrides: ProfileOverrides;
  warnings?: string[];
  exceptions?: ProfileOverrides['exceptions'];
  conformanceFindings?: Parameters<
    typeof buildCoreGovernanceAssessmentArtifacts
  >[0]['conformanceFindings'];
  asOf?: Date;
}

export interface ComposeNxGovernanceRuntimeResult {
  adapterResult: GovernanceWorkspaceAdapterResult;
  workspace: GovernanceWorkspace;
  adapterCapabilities: GovernanceCapability[];
  extensionContext: GovernanceExtensionHostContext;
  extensionRegistration: GovernanceExtensionRegistrationResult;
  artifacts: GovernanceAssessmentArtifacts;
}

export type NxGovernanceWorkspaceGraphSummaryInput = GraphAdapterOptions;

export interface NxGovernanceWorkspaceGraphSummaryResult {
  summary: GraphSummary;
  source: 'host-canonical-workspace' | 'adapter-graph-json';
}

export async function composeNxGovernanceRuntime(
  input: ComposeNxGovernanceRuntimeInput
): Promise<ComposeNxGovernanceRuntimeResult> {
  const { adapterResult } = await loadNxGovernanceWorkspaceContext();
  const workspace = buildGovernanceWorkspace(
    adapterResult,
    input.profileOverrides
  );

  loadGovernanceExtensionConfig({ workspaceRoot: input.workspaceRoot });

  const adapterCapabilities = adapterResult.capabilities ?? [];
  const extensionContext: GovernanceExtensionHostContext = {
    workspaceRoot: input.workspaceRoot,
    profileName: input.profileName,
    options: { ...input.options },
    inventory: workspace,
    capabilities: new DefaultGovernanceCapabilityRegistry(adapterCapabilities),
  };
  const extensionRegistration =
    await registerNxGovernanceExtensionsWithDiagnostics(extensionContext);
  const artifacts = await buildCoreGovernanceAssessmentArtifacts({
    profile: input.profile,
    workspace,
    warnings: input.warnings,
    exceptions: input.exceptions,
    conformanceFindings: input.conformanceFindings ?? [],
    capabilities: adapterCapabilities,
    diagnostics: adapterResult.diagnostics ?? [],
    extensionRegistry: extensionRegistration.registry,
    extensionContext,
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

    return {
      summary: summarizeWorkspaceGraph(snapshot),
      source: 'adapter-graph-json',
    };
  }

  const { adapterResult } = await loadNxGovernanceWorkspaceContext();

  return {
    summary: {
      projectCount:
        adapterResult.nodes?.length ?? adapterResult.projects?.length ?? 0,
      dependencyCount:
        adapterResult.relations?.length ??
        adapterResult.dependencies?.length ??
        0,
    },
    source: 'host-canonical-workspace',
  };
}
